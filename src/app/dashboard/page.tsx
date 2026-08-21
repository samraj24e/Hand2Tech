"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSpinner, faUsers, faBell, faCheck, faTimes, faComments, faMapMarkerAlt, faUserCircle } from "@fortawesome/free-solid-svg-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatModal } from "@/components/ChatModal";
import { toast } from "sonner";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  const [recommendedInnovators, setRecommendedInnovators] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  
  const [activeChatConnection, setActiveChatConnection] = useState<any>(null);
  
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
      } else {
        setUser(session.user);
        loadDashboardData(session.user.id);
        
        // Listen for incoming notifications
        supabase.channel('dashboard_notifications')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            if (payload.new.sender_id !== session.user.id) {
              toast("New message received!");
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'connections' }, payload => {
            if (payload.new.owner_id === session.user.id) {
              toast.success("New connection request!");
              loadDashboardData(session.user.id);
            }
          })
          .subscribe();
      }
    });
    return () => { supabase.removeAllChannels(); };
  }, []);

  const [selectedProject, setSelectedProject] = useState<any>(null);

  async function fetchMatchesForProject(project: any, profileLoc: string) {
    try {
      let { data: matches, error } = await supabase.rpc("find_matching_innovators", { 
        req_skills: project.required_skills || [],
        req_location: project.location || profileLoc || "Earth"
      });
      if (error) console.error("Matches RPC Error:", error);
      
      let finalMatches = (matches || []).filter((m: any) => m.id !== user?.id);
      
      // Fallback: If no exact matches found, just grab some top-rated laborers so the page isn't empty
      if (finalMatches.length === 0) {
        const { data: backup } = await supabase.from("users")
          .select("*")
          .eq("role", "Laborer")
          .neq("id", user?.id)
          .order("rating", { ascending: false })
          .limit(6);
        finalMatches = backup || [];
      }
      
      setRecommendedInnovators(finalMatches);
    } catch (e) {
      console.error("fetchMatches failed", e);
    }
  };

  const loadDashboardData = async (userId: string) => {
    // 1. Get profile
    const { data: profile } = await supabase.from("users").select("*").eq("id", userId).single();
    if (!profile) {
      router.push("/");
      return;
    }
    setUserProfile(profile);

    // 2. Get owned projects
    const { data: myProjects } = await supabase.from("projects").select("*").eq("owner_id", userId);
    setProjects(myProjects || []);

    // 3. If no projects, load default recommendations
    if (!myProjects || myProjects.length === 0) {
      const { data: allUsers } = await supabase.from("users").select("*").neq("id", userId).limit(10);
      setRecommendedInnovators(allUsers || []);
    }

    // 4. Get pending requests to my projects
    const { data: reqs } = await supabase.from("connections")
      .select("*, requester:users!requester_id(*), project:projects(*)")
      .eq("owner_id", userId)
      .eq("status", "pending");
    setPendingRequests(reqs || []);

    // 5. Get active connections (either I am requester or owner)
    const { data: active } = await supabase.from("connections")
      .select("*, requester:users!requester_id(*), owner:users!owner_id(*), project:projects(*)")
      .eq("status", "accepted")
      .or(`owner_id.eq.${userId},requester_id.eq.${userId}`);
    setActiveConnections(active || []);

    setLoading(false);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle || !newProjectDesc) return;
    setIsCreatingProject(true);

    try {
      const res = await fetch('/api/parse-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newProjectTitle,
          description: newProjectDesc,
          userId: user.id
        })
      });
      
      const data = await res.json();
      if (data.error) {
        console.error(data.error);
        alert("Failed to post project: " + data.error);
      } else if (data.project) {
        setNewProjectTitle("");
        setNewProjectDesc("");
        // Prepend the new project to state to instantly show it
        setProjects(prev => [data.project, ...prev]);
        // Also reload other dashboard data if needed
        loadDashboardData(user.id);
      }
    } catch (err) {
      console.error(err);
      alert("Error posting project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleRequestConnect = async (targetUserId: string) => {
    // If I have a project, request them for my project
    const project = projects.find(p => p.status === 'open');
    if (!project) return alert("Create a project first!");
    
    await supabase.from("connections").insert({
      project_id: project.id,
      requester_id: user.id,
      owner_id: targetUserId // Technically the other person is the "target". Wait, schema says owner_id is project owner. So owner_id is me.
      // Wait, schema: Connections: project_id, requester_id, owner_id. 
      // If I request them to join MY project, I am the owner, they are requester? No, let's say they receive the notification.
      // Let's modify: if I find them, I request them. 
    });
    // In our simplified MVP, we just insert a connection where we are the requester, and they are the owner, but actually we own the project.
    // Let's just insert: requester_id: me, owner_id: targetUserId, project_id: my project.
    await supabase.from("connections").insert({
        project_id: project.id,
        requester_id: user.id,
        owner_id: targetUserId
    });
    alert("Connection requested!");
  };

  const handleAccept = async (connId: string) => {
    await supabase.from("connections").update({ status: 'accepted' }).eq("id", connId);
    loadDashboardData(user.id);
  };
  
  const handleReject = async (connId: string) => {
    await supabase.from("connections").update({ status: 'rejected' }).eq("id", connId);
    loadDashboardData(user.id);
  };

  const triggerWhatsAppNotification = (phone: string | null) => {
    if (!phone) {
      toast.error("This user hasn't provided a phone number yet.");
      return;
    }
    const message = encodeURIComponent("Hand2Tech Alert! A VIT student has a new gig matching your skills. Reply YES to bid.");
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, "_blank");
  };

  if (loading) return (
    <div className="min-h-screen relative font-sans flex items-center justify-center">
      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-500 text-4xl" />
    </div>
  );

  const isLaborer = userProfile?.role === 'laborer';

  return (
    <div className="min-h-screen relative font-sans">
      {/* Dynamic Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
      </div>

      {/* Floating Navbar */}
      <div className="sticky top-4 z-40 px-4 max-w-7xl mx-auto">
        <nav className="glass-panel-heavy rounded-2xl flex items-center justify-between px-6 py-4 shadow-sm border border-slate-200">
          <div className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight cursor-default">
            Hand2Tech
          </div>
          <div className="flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger className="relative p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                  <FontAwesomeIcon icon={faBell} className="text-slate-600 text-lg" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse" />
                  )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 glass-panel border-slate-300 text-slate-900 rounded-xl shadow-2xl p-2">
                {pendingRequests.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">No new notifications</div>
                ) : (
                  pendingRequests.map(req => (
                    <DropdownMenuItem key={req.id} className="p-4 flex flex-col items-start gap-3 focus:bg-slate-100/80 rounded-lg cursor-default">
                      <div className="text-sm"><span className="font-bold text-blue-400">{req.requester?.name || "Unknown User"}</span> wants to connect on <span className="font-semibold text-emerald-400">{req.project?.title || "Unknown Project"}</span></div>
                      <div className="flex gap-3 w-full mt-1">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(req.id); }} className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><FontAwesomeIcon icon={faCheck}/></Button>
                        <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleReject(req.id); }} className="flex-1 shadow-[0_0_15px_rgba(239,68,68,0.2)]"><FontAwesomeIcon icon={faTimes}/></Button>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" onClick={() => router.push('/profile')} className="p-2.5 bg-slate-100/50 hover:bg-slate-200/80 rounded-xl transition-all shadow-inner text-slate-700" title="Edit Profile">
              <FontAwesomeIcon icon={faUserCircle} className="text-xl" />
            </Button>

            <Button variant="outline" className="border-slate-300/50 hover:bg-slate-100 hover:text-blue-700 rounded-xl text-sm font-medium" onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}>
              Sign Out
            </Button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {isLaborer ? (
          // Laborer View (Original list layout)
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Recommended Projects & People</h2>
              <div className="w-12 h-12 rounded-full bg-slate-100/50 flex items-center justify-center border border-slate-300/50 backdrop-blur-sm">
                <FontAwesomeIcon icon={faUsers} className="text-emerald-400 text-xl drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedInnovators.map(innovator => (
                <Card key={innovator.id} className="glass-panel border-slate-300/40 hover:border-emerald-500/50 transition-all duration-300 group hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)]">
                  <CardContent className="p-7">
                    <h3 className="font-bold text-xl text-slate-900 group-hover:text-emerald-400">{innovator.name}</h3>
                    <p className="text-sm font-medium text-emerald-500/80 mt-1 capitalize tracking-wider">{innovator.role}</p>
                    <p className="text-sm font-medium text-yellow-500/80 mt-1">★ {Number(innovator.rating || 5.0).toFixed(1)}</p>
                    {innovator.bio && <p className="text-sm text-slate-700 mt-4 line-clamp-2 leading-relaxed">{innovator.bio}</p>}
                    
                    <div className="mt-6 flex flex-col gap-2">
                      <Button onClick={() => handleRequestConnect(innovator.id)} className="w-full bg-slate-100/80 hover:bg-emerald-600 text-slate-900 border border-slate-300 rounded-xl py-6">
                        <FontAwesomeIcon icon={faPlus} className="mr-2" /> Connect
                      </Button>
                      <Button variant="outline" onClick={() => triggerWhatsAppNotification(innovator.phone)} className="w-full bg-green-600/20 hover:bg-green-600 text-green-400 border border-green-700/50 rounded-xl py-6">
                        WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {activeConnections.length > 0 && (
              <Card className="glass-panel mt-10">
                <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Active Collaborations</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {activeConnections.map(conn => (
                    <div key={conn.id} className="p-5 rounded-2xl bg-white/50 border border-slate-300 flex justify-between items-center hover:border-zinc-600 transition-colors">
                      <div><div className="font-bold text-emerald-600">{conn.project.title}</div><div className="text-sm text-slate-600 mt-1">{conn.requester.name}</div></div>
                      <Button onClick={() => setActiveChatConnection(conn)} className="rounded-xl"><FontAwesomeIcon icon={faComments} className="mr-2" /> Chat</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // Innovator View (Master-Detail)
          <div className="space-y-8">
            {!selectedProject ? (
              // Level 1: Project List or Create Project
              <>
                <div className="flex items-center justify-between px-2 mb-6">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">My Projects</h2>
                </div>

                {projects.length === 0 ? (
                  <div className="py-16 text-center text-slate-600 glass-panel rounded-2xl border-dashed border-2 border-slate-300/50 mb-10">
                    <p className="text-2xl font-bold text-slate-700">No projects found.</p>
                    <p className="text-md mt-2">Create a project below to start finding skilled craftsmen.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    {projects.map(project => (
                      <Card 
                        key={project.id} 
                        className="glass-panel cursor-pointer hover:border-blue-500 hover:shadow-2xl transition-all hover:-translate-y-1 overflow-hidden"
                      >
                        <div onClick={() => { setSelectedProject(project); fetchMatchesForProject(project, userProfile?.location); }} className="w-full h-full p-6">
                          <h4 className="font-bold text-xl text-blue-600 mb-2 line-clamp-1">{project.title}</h4>
                          <span className="text-xs px-2 py-1 rounded-md bg-slate-200 text-slate-700 uppercase">{project.status}</span>
                          <p className="text-sm text-slate-600 mt-4 line-clamp-2">{project.description}</p>
                          <div className="mt-6 flex justify-end text-sm font-bold text-blue-500">View Details & Matches →</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Create Project Form always available at root */}
                <Card className="glass-panel max-w-3xl border-slate-300/50 hover:shadow-lg transition-all">
                  <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-[shimmer_3s_infinite]" />
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold">Create New Project</CardTitle>
                    <CardDescription>Describe what you need built, and our AI will extract the skills and match you.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateProject} className="space-y-5">
                      <Input placeholder="Project Title" value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} className="bg-white py-6" required />
                      <Textarea placeholder="Describe the physical labor needed..." value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} className="bg-white min-h-[140px] p-4" required />
                      <Button type="submit" disabled={isCreatingProject} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                        {isCreatingProject ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xl" /> : "Post Project"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </>
            ) : (
              // Level 2: Selected Project View
              <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
                <button 
                  onClick={() => setSelectedProject(null)} 
                  className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} className="rotate-45" /> Back to My Projects
                </button>
                
                <Card className="glass-panel-heavy border-blue-200 shadow-2xl">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-3xl font-extrabold text-blue-700">{selectedProject.title}</CardTitle>
                      <span className="text-xs px-3 py-1 rounded-md bg-blue-100 text-blue-800 uppercase tracking-wider font-bold">{selectedProject.status}</span>
                    </div>
                    <CardDescription className="text-lg text-slate-700 mt-2">{selectedProject.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedProject.bom_estimate && Array.isArray(selectedProject.bom_estimate) && selectedProject.bom_estimate.length > 0 && (
                      <div className="mt-4 p-5 bg-white/60 rounded-xl border border-slate-200">
                        <p className="font-bold text-yellow-600 mb-3 uppercase tracking-widest text-sm flex items-center gap-2">
                          <FontAwesomeIcon icon={faLaptopCode} /> Scrap-to-Proto BOM
                        </p>
                        <ul className="list-disc list-inside text-slate-700 space-y-2 font-medium">
                          {selectedProject.bom_estimate.map((item: string, i: number) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Project Chats */}
                {activeConnections.filter(c => c.project_id === selectedProject.id).length > 0 && (
                  <Card className="glass-panel border-emerald-300">
                    <CardHeader>
                      <CardTitle className="text-emerald-700 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Collaborations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {activeConnections.filter(c => c.project_id === selectedProject.id).map(conn => (
                        <div key={conn.id} className="p-4 rounded-xl bg-white flex justify-between items-center border border-slate-200 hover:border-emerald-400 transition-colors">
                          <div>
                            <span className="font-bold text-slate-800 flex items-center gap-2">
                              <FontAwesomeIcon icon={faUserCircle} className="text-slate-400 text-xl" /> 
                              {conn.requester_id === user?.id ? conn.owner?.name || "Unknown User" : conn.requester?.name || "Unknown User"}
                            </span>
                          </div>
                          <Button onClick={() => setActiveChatConnection(conn)} className="bg-emerald-600 rounded-xl px-6">
                            <FontAwesomeIcon icon={faComments} className="mr-2" /> Chat
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div>
                  <h3 className="text-2xl font-bold mt-12 mb-6 text-slate-800 flex items-center gap-3">
                    <FontAwesomeIcon icon={faUsers} className="text-emerald-500" /> Matching Recommended Craftsmen
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recommendedInnovators.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-slate-500 bg-white/50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-lg font-medium">No craftsmen found for these skills yet.</p>
                      </div>
                    ) : (
                      recommendedInnovators.map(innovator => (
                        <Card key={innovator.id} className="glass-panel hover:shadow-[0_15px_30px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 border-slate-300/40">
                          <CardContent className="p-6">
                            <h4 className="font-bold text-xl text-slate-900 drop-shadow-sm">{innovator.name}</h4>
                            <p className="text-sm font-medium text-emerald-600 mt-1 tracking-wider">★ {Number(innovator.rating || 5).toFixed(1)}</p>
                            {innovator.bio && <p className="text-sm text-slate-600 mt-3 line-clamp-2">{innovator.bio}</p>}
                            <div className="mt-6 flex flex-col gap-2">
                              <Button onClick={() => handleRequestConnect(innovator.id)} className="w-full bg-slate-100/80 hover:bg-emerald-600 text-slate-900 border border-slate-300 hover:border-emerald-500 rounded-xl py-6 transition-all group">
                                <FontAwesomeIcon icon={faPlus} className="mr-2 group-hover:scale-110 transition-transform" /> Request to Connect
                              </Button>
                              <Button variant="outline" onClick={() => triggerWhatsAppNotification(innovator.phone)} className="w-full bg-green-600/10 hover:bg-green-600 text-green-600 hover:text-white border-green-600/30 rounded-xl py-6 transition-all">
                                WhatsApp
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {activeChatConnection && (
        <ChatModal 
          connection={activeChatConnection} 
          currentUser={userProfile} 
          onClose={() => { setActiveChatConnection(null); loadDashboardData(user.id); }} 
        />
      )}
    </div>
  );
}
