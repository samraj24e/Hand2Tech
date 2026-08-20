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

    // 3. If I have projects, get recommendations for the first open project
    // For MVP, just get first project's matches
    if (myProjects && myProjects.length > 0) {
      const openProject = myProjects.find(p => p.status === 'open');
      if (openProject) {
        const { data: matches } = await supabase.rpc("find_matching_innovators", { 
          req_skills: openProject.required_skills,
          req_location: openProject.location || profile.location
        });
        // filter out self
        setRecommendedInnovators((matches || []).filter((m: any) => m.id !== userId));
      }
    } else {
      // If no projects, maybe I'm a laborer looking for projects. MVP simplification: show all users except self
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
      await fetch('/api/parse-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newProjectTitle,
          description: newProjectDesc,
          userId: user.id
        })
      });
      setNewProjectTitle("");
      setNewProjectDesc("");
      loadDashboardData(user.id);
    } catch (err) {
      console.error(err);
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-500 text-4xl" />
    </div>
  );

  const isLaborer = userProfile?.role === 'laborer';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative">
      {/* Dynamic Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
      </div>

      {/* Floating Navbar */}
      <div className="sticky top-4 z-40 px-4 max-w-7xl mx-auto">
        <nav className="glass-panel-heavy rounded-2xl flex items-center justify-between px-6 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-zinc-700/50">
          <div className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent text-glow tracking-tight cursor-default">
            Hand2Tech
          </div>
          <div className="flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger className="relative p-2.5 bg-zinc-800/50 hover:bg-zinc-700/80 rounded-xl transition-all shadow-inner hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                  <FontAwesomeIcon icon={faBell} className="text-zinc-300 text-lg" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse" />
                  )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 glass-panel border-zinc-700 text-zinc-100 rounded-xl shadow-2xl p-2">
                {pendingRequests.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500">No new notifications</div>
                ) : (
                  pendingRequests.map(req => (
                    <DropdownMenuItem key={req.id} className="p-4 flex flex-col items-start gap-3 focus:bg-zinc-800/80 rounded-lg cursor-default">
                      <div className="text-sm"><span className="font-bold text-blue-400">{req.requester.name}</span> wants to connect on <span className="font-semibold text-emerald-400">{req.project.title}</span></div>
                      <div className="flex gap-3 w-full mt-1">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(req.id); }} className="flex-1 bg-emerald-600/90 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"><FontAwesomeIcon icon={faCheck}/></Button>
                        <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleReject(req.id); }} className="flex-1 shadow-[0_0_15px_rgba(239,68,68,0.2)]"><FontAwesomeIcon icon={faTimes}/></Button>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" onClick={() => router.push('/profile')} className="p-2.5 bg-zinc-800/50 hover:bg-zinc-700/80 rounded-xl transition-all shadow-inner text-zinc-300" title="Edit Profile">
              <FontAwesomeIcon icon={faUserCircle} className="text-xl" />
            </Button>

            <Button variant="outline" className="border-zinc-700/50 hover:bg-zinc-800 hover:text-white rounded-xl text-sm font-medium" onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}>
              Sign Out
            </Button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Project Creation & Active Chats */}
        <div className={`lg:col-span-5 space-y-10 ${isLaborer ? 'hidden lg:block' : 'block'}`}>
          <Card className="glass-panel overflow-hidden border-zinc-700/50 transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-[shimmer_3s_infinite]" />
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl font-bold text-zinc-100">Create a Project</CardTitle>
              <CardDescription className="text-zinc-400 mt-2">Describe what you need built, and our AI will instantly extract the required skills.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProject} className="space-y-5">
                <div className="relative group">
                  <Input 
                    placeholder="Project Title (e.g., Custom Drone Chassis)" 
                    className="bg-zinc-950/50 border-zinc-700/50 py-6 rounded-xl focus-visible:ring-blue-500 transition-all"
                    value={newProjectTitle}
                    onChange={e => setNewProjectTitle(e.target.value)}
                  />
                </div>
                <div className="relative group">
                  <Textarea 
                    placeholder="Describe the physical labor or tech integration required..." 
                    className="bg-zinc-950/50 border-zinc-700/50 min-h-[140px] rounded-xl focus-visible:ring-indigo-500 transition-all resize-none p-4"
                    value={newProjectDesc}
                    onChange={e => setNewProjectDesc(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isCreatingProject} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                  {isCreatingProject ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xl" /> : "Post Project"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* My Projects */}
          {projects.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                My Projects
              </h3>
              {projects.map(project => (
                <Card key={project.id} className="glass-panel border-zinc-700/50 hover:border-blue-500/30 transition-all">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-lg text-blue-400">{project.title}</h4>
                      <span className="text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 uppercase tracking-wider">{project.status}</span>
                    </div>
                    <p className="text-sm text-zinc-300 mt-2 line-clamp-2">{project.description}</p>
                    
                    {/* BOM Estimate */}
                    {project.bom_estimate && Array.isArray(project.bom_estimate) && project.bom_estimate.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-800/80">
                        <p className="text-xs font-semibold text-yellow-500/80 uppercase tracking-wider mb-2">Scrap-to-Proto BOM</p>
                        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                          {project.bom_estimate.map((item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Active Chats */}
          {activeConnections.length > 0 && (
            <Card className="glass-panel border-zinc-700/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Collaborations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeConnections.map(conn => (
                  <div key={conn.id} className="p-5 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-zinc-600 transition-colors">
                    <div>
                      <div className="font-bold text-emerald-400 tracking-wide">{conn.project.title}</div>
                      <div className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                        <FontAwesomeIcon icon={faUserCircle} className="text-zinc-500" />
                        {conn.requester_id === user.id ? conn.owner.name : conn.requester.name}
                      </div>
                    </div>
                    <Button variant="outline" className="rounded-xl border-zinc-700 hover:bg-zinc-800 hover:text-white shadow-inner bg-zinc-900/50" onClick={() => setActiveChatConnection(conn)}>
                      <FontAwesomeIcon icon={faComments} className="mr-2" /> Chat
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Innovators Feed */}
        <div className={`lg:col-span-7 space-y-8 ${isLaborer ? 'col-span-1' : ''}`}>
          <div className="flex items-center justify-between px-2">
            <h2 className="text-3xl font-bold tracking-tight text-glow">
              {isLaborer ? "Recommended Projects & People" : "Recommended Innovators"}
            </h2>
            <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 backdrop-blur-sm">
              <FontAwesomeIcon icon={faUsers} className="text-emerald-400 text-xl drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendedInnovators.map(innovator => (
              <Card key={innovator.id} className="glass-panel border-zinc-700/40 hover:border-emerald-500/50 transition-all duration-300 group cursor-default hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)]">
                <CardContent className="p-7">
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h3 className="font-bold text-xl text-zinc-100 group-hover:text-emerald-400 transition-colors drop-shadow-md">{innovator.name}</h3>
                      <p className="text-sm font-medium text-emerald-500/80 capitalize tracking-wider mt-1">{innovator.role}</p>
                      <p className="text-sm font-medium text-yellow-500/80 mt-1">★ {Number(innovator.rating || 5.0).toFixed(1)}</p>
                      {innovator.location && (
                        <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5"><FontAwesomeIcon icon={faMapMarkerAlt} className="text-zinc-500" />{innovator.location}</p>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                      <span className="text-emerald-400 font-extrabold text-lg drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">{innovator.name.charAt(0)}</span>
                    </div>
                  </div>

                  {innovator.bio && (
                    <p className="text-sm text-zinc-300 mb-6 line-clamp-2 leading-relaxed">{innovator.bio}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mb-8">
                    {(innovator.skills || []).map((skill: string, idx: number) => (
                      <span key={idx} className="px-3 py-1.5 rounded-lg bg-zinc-900/80 text-xs font-semibold text-zinc-300 border border-zinc-700/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button 
                      onClick={() => handleRequestConnect(innovator.id)}
                      className="w-full bg-zinc-800/80 hover:bg-emerald-600 text-zinc-100 transition-all duration-300 border border-zinc-700 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-xl py-6"
                    >
                      <FontAwesomeIcon icon={faPlus} className="mr-2" /> Request to Connect
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => triggerWhatsAppNotification(innovator.phone)}
                      className="w-full bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white transition-all duration-300 border border-green-700/50 rounded-xl py-6"
                    >
                      Post Project & Notify Laborer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {recommendedInnovators.length === 0 && (
              <div className="col-span-full py-16 text-center text-zinc-400 glass-panel rounded-2xl border-dashed border-2 border-zinc-700/50">
                <FontAwesomeIcon icon={faUsers} className="text-4xl text-zinc-600 mb-4" />
                <p className="text-lg">No exact matches found right now.</p>
                <p className="text-sm text-zinc-500 mt-2">Check back later or update your project skills.</p>
              </div>
            )}
          </div>
        </div>
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
