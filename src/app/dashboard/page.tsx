"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { parseProfileMetadata, parseProjectMetadata } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSpinner, faUsers, faBell, faCheck, faTimes, faComments, faMapMarkerAlt, faUserCircle, faHammer, faLaptopCode } from "@fortawesome/free-solid-svg-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatModal } from "@/components/ChatModal";
import { WorkerProfileModal } from "@/components/WorkerProfileModal";
import { toast } from "sonner";

import { QRCodeSVG } from 'qrcode.react';

const ProjectCountdown = ({ dateStr }: { dateStr: string }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const target = new Date(dateStr).getTime();
      const now = new Date().getTime();
      const diff = target - now;
      
      setIsPast(diff < 0);
      const absDiff = Math.abs(diff);
      const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((absDiff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [dateStr]);

  // The user requested green color specifically for countdown!
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700`}>
      {isPast ? "Overdue by: " : "Closes in: "} {timeLeft}
    </span>
  );
};

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectDomain, setNewProjectDomain] = useState("");
  const [newProjectClosingTime, setNewProjectClosingTime] = useState("");
  const [newProjectDistanceLimit, setNewProjectDistanceLimit] = useState("");
  const [newProjectPhase, setNewProjectPhase] = useState("Idea");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  const [recommendedInnovators, setRecommendedInnovators] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeConnections, setActiveConnections] = useState<any[]>([]);
  const [activeChatConnection, setActiveChatConnection] = useState<any>(null);
  
  const [selectedWorkerProfile, setSelectedWorkerProfile] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  
  const [reviewingConnection, setReviewingConnection] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  const [qrCodeConnection, setQrCodeConnection] = useState<any>(null);
  const [verifyClosingConnection, setVerifyClosingConnection] = useState<any>(null);
  const [verifyPin, setVerifyPin] = useState("");
  
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
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'connections' }, payload => {
            if (payload.new.owner_id === session.user.id && payload.new.status === 'pending') {
              toast.success("Connection request renewed!");
              loadDashboardData(session.user.id);
            } else if (payload.new.requester_id === session.user.id || payload.new.owner_id === session.user.id) {
               // Also catch if the other party accepts it, etc.
               loadDashboardData(session.user.id);
            }
          })
          .subscribe();
      }
    });
    return () => { supabase.removeAllChannels(); };
  }, []);


  async function fetchMatchesForProject(project: any, profileLoc: string) {
    try {
      let { data: matches, error } = await supabase.rpc("find_matching_innovators", { 
        req_skills: project.required_skills || [],
        req_location: project.location || profileLoc || "Earth"
      });
      if (error) console.error("Matches RPC Error:", error);
      
      let finalMatches = (matches || []).filter((m: any) => m.id !== user?.id);
      
      // Calculate Skill Match Score
      const reqSkills = project.required_skills || [];
      finalMatches = finalMatches.map((m: any) => {
        let matchCount = 0;
        const userSkills = m.skills || [];
        reqSkills.forEach((rs: string) => {
          if (userSkills.some((us: string) => us.toLowerCase() === rs.toLowerCase())) matchCount++;
        });
        const matchScore = reqSkills.length > 0 ? Math.round((matchCount / reqSkills.length) * 100) : 0;
        return { ...m, matchScore };
      });

      // Filter by Proximity (Distance Limit)
      const pMetadata = parseProjectMetadata(project.description);
      const limit = parseInt(pMetadata.distance_limit || "0");
      
      finalMatches = finalMatches.map((m: any) => {
        // Mock distance calculation based on user IDs so it's consistent
        const mockDist = Math.abs((m.id.charCodeAt(0) * project.id.charCodeAt(0)) % 150);
        return { ...m, distance: mockDist };
      });

      if (limit > 0) {
        finalMatches = finalMatches.filter((m: any) => m.distance <= limit);
      }

      // Sort by Match Score, then Rating
      finalMatches.sort((a: any, b: any) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return (b.rating || 0) - (a.rating || 0);
      });
      
      // Fallback: If no exact matches found
      if (finalMatches.length === 0) {
        const { data: backup } = await supabase.from("users")
          .select("*")
          .eq("role", "laborer")
          .neq("id", user?.id)
          .order("rating", { ascending: false })
          .limit(6);
        finalMatches = (backup || []).map((m:any) => ({ ...m, matchScore: 0 }));
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
    const { data: reqs, error: reqsError } = await supabase.from("connections")
      .select("*, requester:users!requester_id(*), project:projects(*)")
      .eq("owner_id", userId)
      .eq("status", "pending");
    if (reqsError) console.error("Error fetching pending requests:", reqsError);
    setPendingRequests(reqs || []);

    // 5. Get active connections (either I am requester or owner)
    const { data: active } = await supabase.from("connections")
      .select("*, requester:users!requester_id(*), owner:users!owner_id(*), project:projects(*)")
      .in("status", ["accepted", "closing_pending", "completed_unreviewed"])
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
          descriptionText: newProjectDesc,
          domain: newProjectDomain,
          closing_time: newProjectClosingTime,
          distance_limit: newProjectDistanceLimit,
          project_phase: newProjectPhase,
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

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      await supabase.from("projects").delete().eq("id", projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) setSelectedProject(null);
    }
  };

  const handleRequestConnect = async (targetUserId: string) => {
    const projectToConnect = selectedProject || projects.find(p => p.status === 'open');
    if (!projectToConnect) {
      toast.error("Please select or create a project first!");
      return;
    }
    
    // Check if connection already exists to allow prototyping the flow multiple times
    const { data: existing } = await supabase.from("connections")
      .select("id, status")
      .eq("project_id", projectToConnect.id)
      .eq("requester_id", user.id)
      .eq("owner_id", targetUserId)
      .maybeSingle();

    if (existing) {
      // Reset the existing connection to pending so they can prototype the flow again!
      const { error: updateError } = await supabase.from("connections")
        .update({ status: 'pending' })
        .eq("id", existing.id);
        
      if (updateError) {
        toast.error("Failed to send request: " + updateError.message);
        return;
      }
    } else {
      // Insert new connection
      const { error: insertError } = await supabase.from("connections").insert({
          project_id: projectToConnect.id,
          requester_id: user.id,
          owner_id: targetUserId,
          status: 'pending'
      });

      if (insertError) {
        toast.error("Failed to send request: " + insertError.message);
        return;
      }
    }
    
    toast.success(`Request sent for project: ${projectToConnect.title}`);
  };

  const handleSubmitReview = async () => {
    if (!reviewingConnection) return;
    setIsSubmittingReview(true);
    
    // Find the worker ID
    const workerId = reviewingConnection.requester_id === user.id ? reviewingConnection.owner_id : reviewingConnection.requester_id;
    
    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          reviewerName: userProfile?.name || 'Anonymous Innovator',
          rating: reviewRating,
          text: reviewText
        })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success("Review submitted! The project is now completed.");
        // Mark connection as completed
        await supabase.from("connections").update({ status: 'completed' }).eq('id', reviewingConnection.id);
        // Also close the project itself!
        await supabase.from("projects").update({ status: 'closed' }).eq('id', reviewingConnection.project_id);
        
        setActiveConnections(prev => prev.filter(c => c.id !== reviewingConnection.id));
        setProjects(prev => prev.map(p => p.id === reviewingConnection.project_id ? { ...p, status: 'closed' } : p));
        setReviewingConnection(null);
        setReviewText("");
        setReviewRating(5);
      } else {
        toast.error("Failed to submit review: " + data.error);
      }
    } catch (e) {
      toast.error("Error submitting review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleInitiateClose = async (conn: any) => {
    // 1. Update status to closing_pending
    await supabase.from("connections").update({ status: 'closing_pending' }).eq('id', conn.id);
    setQrCodeConnection(conn);
    toast.success("Closing initiated. Share the QR code with the craftsman!");
    loadDashboardData(user.id);
  };

  const handleVerifyClose = async () => {
    if (!verifyClosingConnection || !verifyPin) return;
    const correctPin = verifyClosingConnection.id.substring(0, 6).toUpperCase();
    if (verifyPin.toUpperCase() === correctPin) {
      await supabase.from("connections").update({ status: 'completed_unreviewed' }).eq('id', verifyClosingConnection.id);
      toast.success("Project verified as completed!");
      setVerifyClosingConnection(null);
      setVerifyPin("");
      loadDashboardData(user.id);
    } else {
      toast.error("Incorrect PIN. Please check with the Innovator.");
    }
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

  if (loading) return <div className="min-h-screen bg-slate-50 relative font-sans" />;

  const isLaborer = userProfile?.role === 'laborer';

  return (
    <div className="min-h-screen relative font-sans">
      {/* Dynamic Background removed */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10 bg-slate-50">
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
        {/* Dashboard Title Card */}
        <div className="mb-8">
          <Card className="bg-blue-600 border-none shadow-md rounded-2xl overflow-hidden">
            <CardContent className="p-6 sm:p-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {isLaborer ? "Skilled Craftsman Dashboard" : "Tech Innovator Dashboard"}
                </h1>
                <p className="text-blue-100 mt-2 font-medium">
                  {isLaborer ? "Find gigs and manage your active collaborations." : "Manage your projects and connect with skilled craftsmen."}
                </p>
              </div>
              <div className="hidden sm:flex w-16 h-16 rounded-full bg-white/20 items-center justify-center">
                <FontAwesomeIcon icon={isLaborer ? faHammer : faLaptopCode} className="text-3xl text-white drop-shadow-md" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {isLaborer ? (
            <>
              <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Available Gigs</p>
                  <div className="text-4xl font-extrabold text-blue-600">{recommendedInnovators.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Collaborations</p>
                  <div className="text-4xl font-extrabold text-emerald-600">{activeConnections.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">My Rating</p>
                  <div className="text-4xl font-extrabold text-yellow-500">★ {Number(userProfile?.rating || 5.0).toFixed(1)}</div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Projects</p>
                  <div className="text-4xl font-extrabold text-blue-600">{projects.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Projects</p>
                  <div className="text-4xl font-extrabold text-emerald-600">{projects.filter(p => p.status === 'open' || !p.status).length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Collaborations</p>
                  <div className="text-4xl font-extrabold text-indigo-600">{activeConnections.length}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

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
                    {innovator.bio && <p className="text-sm text-slate-700 mt-4 line-clamp-2 leading-relaxed">{parseProfileMetadata(innovator.bio).bioText || parseProfileMetadata(innovator.bio).domain_interests}</p>}
                    
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
                      <div className="flex gap-2">
                        {conn.status === 'closing_pending' && (
                          <Button onClick={() => setVerifyClosingConnection(conn)} className="bg-purple-600 hover:bg-purple-500 rounded-xl px-4 animate-pulse">
                            Verify Closing
                          </Button>
                        )}
                        <Button onClick={() => setActiveChatConnection(conn)} className="rounded-xl"><FontAwesomeIcon icon={faComments} className="mr-2" /> Chat</Button>
                      </div>
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
                        onClick={() => {
                          setSelectedProject(project);
                          fetchMatchesForProject(project, userProfile?.location);
                        }}
                        className="glass-panel cursor-pointer hover:border-blue-500 hover:shadow-2xl transition-all hover:-translate-y-1 overflow-hidden"
                      >
                        <div className="w-full h-full p-6">
                          <h4 className="font-bold text-xl text-blue-600 mb-2 line-clamp-1">{project.title}</h4>
                          <span className="text-xs px-2 py-1 rounded-md bg-slate-200 text-slate-700 uppercase">{project.status}</span>
                          <p className="text-sm text-slate-600 mt-4 line-clamp-2">{parseProjectMetadata(project.description).descriptionText}</p>
                          <div className="mt-6 flex justify-end text-sm font-bold text-blue-500">View Details & Matches →</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Create Project Form always available at root */}
                <Card className="glass-panel max-w-3xl border-slate-300/50 hover:shadow-lg transition-all">
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold">Create New Project</CardTitle>
                    <CardDescription>Describe what you need built, and our AI will extract the skills and match you.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateProject} className="space-y-5">
                      <Input placeholder="Project Title" value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} className="bg-white py-6 rounded-xl" required />
                      <Textarea placeholder="Describe the physical labor needed, materials required, and the goal of the project..." value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} className="bg-white min-h-[140px] p-4 rounded-xl" required />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input placeholder="Domain (e.g. Health, Agri, Finance)" value={newProjectDomain} onChange={e => setNewProjectDomain(e.target.value)} className="bg-white py-6 rounded-xl" />
                        <Input placeholder="Closing Date (e.g. 2026-12-01)" type="date" value={newProjectClosingTime} onChange={e => setNewProjectClosingTime(e.target.value)} className="bg-white py-6 rounded-xl" />
                        
                        <Input 
                          type="number" 
                          placeholder="Max Distance (km)" 
                          value={newProjectDistanceLimit} 
                          onChange={e => setNewProjectDistanceLimit(e.target.value)} 
                          className="bg-white py-6 rounded-xl"
                        />
                        
                        <select 
                          value={newProjectPhase} 
                          onChange={e => setNewProjectPhase(e.target.value)} 
                          className="bg-white py-3 px-4 rounded-xl border border-slate-300 w-full"
                        >
                          <option value="Idea">Idea Phase</option>
                          <option value="Prototype">Prototype</option>
                          <option value="Production">Production</option>
                        </select>
                      </div>

                      <Button type="submit" disabled={isCreatingProject} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-6 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] mt-2">
                        {isCreatingProject ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xl" /> : "Post Project"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </>
            ) : (
              // Level 2: Selected Project View
              <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => setSelectedProject(null)} 
                    className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} className="rotate-45" /> Back to My Projects
                  </button>
                  <Button variant="destructive" onClick={() => handleDeleteProject(selectedProject.id)} className="bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white rounded-xl">
                    Delete Project
                  </Button>
                </div>
                
                <Card className="glass-panel-heavy border-blue-200 shadow-2xl">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-3xl font-extrabold text-blue-700">{selectedProject.title}</CardTitle>
                      <span className="text-xs px-3 py-1 rounded-md bg-blue-100 text-blue-800 uppercase tracking-wider font-bold">{selectedProject.status}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 mt-3">
                      {parseProjectMetadata(selectedProject.description).domain && (
                        <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">Domain: {parseProjectMetadata(selectedProject.description).domain}</span>
                      )}
                      {parseProjectMetadata(selectedProject.description).distance_limit && (
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">Range: {parseProjectMetadata(selectedProject.description).distance_limit} km</span>
                      )}
                      {parseProjectMetadata(selectedProject.description).project_phase && (
                        <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-3 py-1 rounded-full">Phase: {parseProjectMetadata(selectedProject.description).project_phase}</span>
                      )}
                      {parseProjectMetadata(selectedProject.description).closing_time && (
                        <ProjectCountdown dateStr={parseProjectMetadata(selectedProject.description).closing_time!} />
                      )}
                    </div>

                    <CardDescription className="text-lg text-slate-700 mt-4 whitespace-pre-wrap">{parseProjectMetadata(selectedProject.description).descriptionText}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const projConnections = activeConnections.filter(c => c.project_id === selectedProject.id);
                      if (projConnections.length > 0) {
                        const conn = projConnections[0];
                        return (
                          <div className="mt-4 p-5 bg-white/60 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-800 mb-2">Project Controls</h4>
                            {conn.status === 'accepted' && (
                              <Button onClick={() => handleInitiateClose(conn)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-6 px-8">
                                <FontAwesomeIcon icon={faCheck} className="mr-2" /> Mark Project as Completed (Generate Code)
                              </Button>
                            )}
                            {conn.status === 'closing_pending' && (
                              <Button onClick={() => setQrCodeConnection(conn)} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-6 px-8">
                                Show Verification PIN / QR
                              </Button>
                            )}
                            {conn.status === 'completed_unreviewed' && (
                              <Button onClick={() => setReviewingConnection(conn)} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white rounded-xl py-6 px-8 animate-pulse">
                                <FontAwesomeIcon icon={faStar} className="mr-2" /> Leave Review for Worker
                              </Button>
                            )}
                            {conn.status === 'completed' && (
                              <p className="text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-lg inline-block">
                                <FontAwesomeIcon icon={faCheck} className="mr-2" /> Project Completed
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                          <div className="flex gap-2">
                            {conn.status === 'accepted' && (
                              <Button onClick={() => handleInitiateClose(conn)} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl px-4">
                                <FontAwesomeIcon icon={faCheck} className="mr-2" /> Close Project
                              </Button>
                            )}
                            {conn.status === 'closing_pending' && (
                              <Button onClick={() => setQrCodeConnection(conn)} variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50 rounded-xl px-4">
                                Show QR / PIN
                              </Button>
                            )}
                            {conn.status === 'completed_unreviewed' && (
                              <Button onClick={() => setReviewingConnection(conn)} variant="default" className="bg-amber-500 hover:bg-amber-400 text-white rounded-xl px-4">
                                <FontAwesomeIcon icon={faStar} className="mr-2" /> Leave Review
                              </Button>
                            )}
                            <Button onClick={() => setActiveChatConnection(conn)} className="bg-emerald-600 rounded-xl px-6">
                              <FontAwesomeIcon icon={faComments} className="mr-2" /> Chat
                            </Button>
                          </div>
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
                            <h4 className="font-bold text-xl text-slate-900 drop-shadow-sm flex items-center justify-between">
                              {innovator.name}
                              {innovator.matchScore > 0 && (
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{innovator.matchScore}% Match</span>
                              )}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-sm font-medium text-emerald-600 tracking-wider">★ {Number(innovator.rating || 5).toFixed(1)}</p>
                              {innovator.distance !== undefined && (
                                <p className="text-sm font-medium text-slate-500">• {innovator.distance} km away</p>
                              )}
                            </div>
                            {innovator.bio && <p className="text-sm text-slate-600 mt-3 line-clamp-2">{parseProfileMetadata(innovator.bio).bioText || parseProfileMetadata(innovator.bio).domain_interests}</p>}
                            
                            {/* Summary Details */}
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-1">
                              {parseProfileMetadata(innovator.bio).years_of_experience && (
                                <p className="text-xs text-slate-500 font-semibold"><span className="text-emerald-600">Exp:</span> {parseProfileMetadata(innovator.bio).years_of_experience}</p>
                              )}
                              {parseProfileMetadata(innovator.bio).previous_works && (
                                <p className="text-xs text-slate-500 font-semibold line-clamp-1"><span className="text-blue-600">Works:</span> {parseProfileMetadata(innovator.bio).previous_works}</p>
                              )}
                            </div>

                            <div className="mt-6 flex flex-col gap-2">
                              <Button variant="outline" onClick={() => setSelectedWorkerProfile(innovator)} className="w-full bg-blue-50/50 hover:bg-blue-100 text-blue-700 border-blue-200 rounded-xl py-5">
                                View Full Profile
                              </Button>
                              <div className="flex gap-2">
                                <Button onClick={() => handleRequestConnect(innovator.id)} className="flex-1 bg-slate-100/80 hover:bg-emerald-600 text-slate-900 border border-slate-300 hover:border-emerald-500 rounded-xl py-5 transition-all group">
                                  <FontAwesomeIcon icon={faPlus} className="mr-2 group-hover:scale-110 transition-transform" /> Connect
                                </Button>
                                <Button variant="outline" onClick={() => triggerWhatsAppNotification(innovator.phone)} className="flex-1 bg-green-600/10 hover:bg-green-600 text-green-600 hover:text-white border-green-600/30 rounded-xl py-5 transition-all">
                                  WhatsApp
                                </Button>
                              </div>
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

      {/* Worker Profile Modal */}
      {selectedWorkerProfile && (
        <WorkerProfileModal 
          worker={selectedWorkerProfile}
          onClose={() => setSelectedWorkerProfile(null)}
          onRequestConnect={(id) => {
             setSelectedWorkerProfile(null);
             handleRequestConnect(id);
          }}
        />
      )}

      {/* Review Modal */}
      {reviewingConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-in slide-in-from-bottom-8">
            <button onClick={() => setReviewingConnection(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <FontAwesomeIcon icon={faTimes} className="text-xl" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete & Review</h2>
            <p className="text-sm text-slate-600 mb-6">Rate this craftsman's work on this project and leave a public review.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Rating ({reviewRating}/5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setReviewRating(star)} className={`text-3xl ${reviewRating >= star ? 'text-amber-500' : 'text-slate-200'} hover:scale-110 transition-transform`}>
                      ★
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Review Text</label>
                <Textarea placeholder="Share your experience working with them..." value={reviewText} onChange={e => setReviewText(e.target.value)} className="bg-slate-50 border-slate-200 min-h-[100px]" />
              </div>
              
              <Button onClick={handleSubmitReview} disabled={isSubmittingReview} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-6 rounded-xl mt-4">
                {isSubmittingReview ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : "Submit Review & Mark Completed"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Generator Modal (Innovator) */}
      {qrCodeConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative text-center animate-in slide-in-from-bottom-8">
            <button onClick={() => setQrCodeConnection(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Close Project</h2>
            <p className="text-sm text-slate-500 mb-6">Show this QR Code or share the PIN with the craftsman to verify completion.</p>
            
            <div className="bg-white p-4 inline-block rounded-xl border border-slate-200 shadow-sm mb-6">
              <QRCodeSVG value={qrCodeConnection.id.substring(0,6).toUpperCase()} size={200} />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Verification PIN</p>
              <p className="text-3xl font-black text-slate-800 tracking-[0.25em]">{qrCodeConnection.id.substring(0,6).toUpperCase()}</p>
            </div>
            
            <p className="text-xs text-slate-400 italic">Waiting for craftsman to verify...</p>
          </div>
        </div>
      )}

      {/* Verify Closing Modal (Craftsman) */}
      {verifyClosingConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl relative text-center animate-in slide-in-from-bottom-8">
            <button onClick={() => setVerifyClosingConnection(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify Closing</h2>
            <p className="text-sm text-slate-500 mb-6">Enter the 6-character PIN provided by the project owner to mark this job as completed.</p>
            
            <Input 
              value={verifyPin}
              onChange={(e) => setVerifyPin(e.target.value.toUpperCase())}
              placeholder="Enter PIN"
              maxLength={6}
              className="text-center text-3xl font-black tracking-widest h-16 rounded-xl mb-6 uppercase" 
            />

            <Button onClick={handleVerifyClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-6 rounded-xl">
              Verify & Complete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
