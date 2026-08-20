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

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-500 text-4xl" />
    </div>
  );

  const isLaborer = userProfile?.role === 'laborer';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Navbar */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Hand2Tech
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger className="relative p-2 hover:bg-zinc-800 rounded-md transition-colors">
                  <FontAwesomeIcon icon={faBell} className="text-zinc-400 text-lg" />
                  {pendingRequests.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-zinc-900 border-zinc-800 text-zinc-100">
                {pendingRequests.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500">No new notifications</div>
                ) : (
                  pendingRequests.map(req => (
                    <DropdownMenuItem key={req.id} className="p-3 flex flex-col items-start gap-2 focus:bg-zinc-800">
                      <div><span className="font-bold text-blue-400">{req.requester.name}</span> wants to connect on <span className="font-semibold text-emerald-400">{req.project.title}</span></div>
                      <div className="flex gap-2 w-full">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(req.id); }} className="flex-1 bg-blue-600 hover:bg-blue-700"><FontAwesomeIcon icon={faCheck}/></Button>
                        <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleReject(req.id); }} className="flex-1"><FontAwesomeIcon icon={faTimes}/></Button>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" onClick={() => router.push('/profile')} title="Edit Profile">
              <FontAwesomeIcon icon={faUserCircle} className="text-xl" />
            </Button>

            <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}>
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Project Creation & Active Chats */}
        <div className={`lg:col-span-5 space-y-8 ${isLaborer ? 'hidden lg:block' : 'block'}`}>
          <Card className="bg-zinc-900/50 border-zinc-800 shadow-xl overflow-hidden backdrop-blur-sm">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardHeader>
              <CardTitle>Create a Project</CardTitle>
              <CardDescription className="text-zinc-400">Describe what you need built, and our AI will extract required skills.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <Input 
                  placeholder="Project Title (e.g., Custom Drone Chassis)" 
                  className="bg-zinc-950 border-zinc-800"
                  value={newProjectTitle}
                  onChange={e => setNewProjectTitle(e.target.value)}
                />
                <Textarea 
                  placeholder="Describe the physical labor or tech integration required..." 
                  className="bg-zinc-950 border-zinc-800 min-h-[120px]"
                  value={newProjectDesc}
                  onChange={e => setNewProjectDesc(e.target.value)}
                />
                <Button type="submit" disabled={isCreatingProject} className="w-full bg-blue-600 hover:bg-blue-700">
                  {isCreatingProject ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : "Post Project"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Active Chats */}
          {activeConnections.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800 shadow-xl backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Active Collaborations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeConnections.map(conn => (
                  <div key={conn.id} className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-emerald-400">{conn.project.title}</div>
                      <div className="text-xs text-zinc-400">with {conn.requester_id === user.id ? conn.owner.name : conn.requester.name}</div>
                    </div>
                    <Button variant="outline" size="sm" className="border-zinc-600 hover:bg-zinc-700 hover:text-white" onClick={() => setActiveChatConnection(conn)}>
                      <FontAwesomeIcon icon={faComments} className="mr-2" /> Chat
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Innovators Feed */}
        <div className={`lg:col-span-7 space-y-6 ${isLaborer ? 'col-span-1' : ''}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {isLaborer ? "Recommended Projects & People" : "Recommended Innovators"}
            </h2>
            <FontAwesomeIcon icon={faUsers} className="text-zinc-500 text-xl" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendedInnovators.map(innovator => (
              <Card key={innovator.id} className="bg-zinc-900/80 border-zinc-800 shadow-lg hover:border-emerald-500/50 transition-colors group cursor-default">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-zinc-100 group-hover:text-emerald-400 transition-colors">{innovator.name}</h3>
                      <p className="text-sm text-zinc-500 capitalize">{innovator.role}</p>
                      {innovator.location && (
                        <p className="text-xs text-zinc-400 mt-1"><FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1" />{innovator.location}</p>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-emerald-500 font-bold">{innovator.name.charAt(0)}</span>
                    </div>
                  </div>

                  {innovator.bio && (
                    <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{innovator.bio}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(innovator.skills || []).map((skill: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-300 border border-zinc-700">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <Button 
                    onClick={() => handleRequestConnect(innovator.id)}
                    className="w-full bg-zinc-800 hover:bg-emerald-600 text-zinc-100 transition-all border border-zinc-700 group-hover:border-emerald-500"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" /> Request to Connect
                  </Button>
                </CardContent>
              </Card>
            ))}
            
            {recommendedInnovators.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed">
                No exact matches found right now.
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
