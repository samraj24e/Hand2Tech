"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faTimes, faSpinner, faPaperclip, faTasks, faCheckCircle, faCircle } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ChatUI({ connection, currentUser, onClose }: { connection: any, currentUser: any, onClose: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!connection) return;

    // Fetch existing messages and milestones
    const fetchData = async () => {
      const [msgsRes, msRes] = await Promise.all([
        supabase.from("messages").select("*").eq("connection_id", connection.id).order("created_at", { ascending: true }),
        supabase.from("milestones").select("*").eq("connection_id", connection.id).order("created_at", { ascending: true })
      ]);
      setMessages(msgsRes.data || []);
      setMilestones(msRes.data || []);
      setLoading(false);
    };

    fetchData();

    // Subscribe to realtime messages and milestones
    const channel = supabase.channel(`room_${connection.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `connection_id=eq.${connection.id}` }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones', filter: `connection_id=eq.${connection.id}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setMilestones(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setMilestones(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connection]);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText("");
    
    let translated_text = null;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg })
      });
      const data = await res.json();
      translated_text = data.translated_text;
    } catch (e) {
      console.error("Translation error", e);
    }
    
    await supabase.from("messages").insert({
      connection_id: connection.id,
      sender_id: currentUser.id,
      text: msg,
      translated_text
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const fileName = `${connection.id}/${Date.now()}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat_files')
      .upload(fileName, file);
      
    if (uploadError) {
      toast.error("Failed to upload file");
      setUploading(false);
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('chat_files').getPublicUrl(fileName);
    
    await supabase.from("messages").insert({
      connection_id: connection.id,
      sender_id: currentUser.id,
      text: `📎 Shared a file: ${file.name}`,
      file_url: publicUrl
    });
    
    setUploading(false);
  };

  const addMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    await supabase.from("milestones").insert({
      connection_id: connection.id,
      title: newMilestoneTitle
    });
    setNewMilestoneTitle("");
  };

  const toggleMilestone = async (m: any) => {
    await supabase.from("milestones").update({ is_completed: !m.is_completed }).eq("id", m.id);
  };

  const closeProject = async () => {
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    const targetUserId = connection.requester_id === currentUser.id ? connection.owner_id : connection.requester_id;
    
    const { data: targetUser } = await supabase.from("users").select("rating").eq("id", targetUserId).single();
    
    let newRating = rating;
    if (targetUser && targetUser.rating) {
      newRating = (Number(targetUser.rating) + rating) / 2;
    }
    
    await supabase.from("users").update({ rating: newRating }).eq("id", targetUserId);
    await supabase.from("connections").update({ status: 'completed' }).eq("id", connection.id);
    
    setShowRatingModal(false);
    onClose();
  };

  if (loading) {
    return (
      <Card className="w-full flex justify-center p-10 h-[500px] items-center border border-slate-200 shadow-sm rounded-3xl">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-blue-500" />
      </Card>
    );
  }

  const isOwner = connection?.owner_id === currentUser?.id;

  return (
    <>
      <Card className="w-full glass-panel-heavy p-0 overflow-hidden flex flex-col md:flex-row h-[700px] border-slate-300/60 shadow-lg rounded-3xl relative">
        
        {/* Main Chat Area */}
        <div className={`flex flex-col h-full flex-1 transition-all duration-300 ${showMilestones ? 'w-full md:w-2/3' : 'w-full'}`}>
          <div className="p-5 border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                Project Chat
              </h3>
              <p className="text-sm text-slate-500 mt-1">Secure realtime communication</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowMilestones(!showMilestones)} className={`transition-all rounded-xl border-slate-300 ${showMilestones ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-slate-100/50 hover:bg-slate-200'}`}>
                <FontAwesomeIcon icon={faTasks} className="mr-2" /> Milestones
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200">
                <FontAwesomeIcon icon={faTimes} className="mr-2" /> Hide
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/80 relative">
            {/* Ambient glow inside chat */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
            
            {messages.map((m, i) => {
              const isMe = m.sender_id === currentUser.id;
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-md relative group ${isMe ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-900 rounded-bl-sm border border-slate-300/50'}`}>
                    <div className="break-words leading-relaxed text-[15px]">{m.text}</div>
                    {m.translated_text && m.translated_text !== m.text && (
                      <div className="break-words leading-relaxed text-[13px] mt-2 pt-2 border-t border-white/20 italic opacity-80">
                        {m.translated_text}
                      </div>
                    )}
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs bg-black/30 px-3 py-2 rounded-lg hover:bg-black/50 transition-colors border border-white/10 w-full">
                        <FontAwesomeIcon icon={faPaperclip} /> View Attachment
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-200/80 bg-slate-50/60 backdrop-blur-xl">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-3 items-center">
              <label className={`flex items-center justify-center w-12 h-12 bg-slate-100/80 rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-200 hover:border-zinc-500 transition-all ${uploading ? 'opacity-50' : ''}`}>
                <FontAwesomeIcon icon={uploading ? faSpinner : faPaperclip} className={uploading ? 'animate-spin text-blue-400' : 'text-slate-600 group-hover:text-slate-800'} />
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              
              <Input 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Type your message..."
                className="bg-white/80 border-slate-300 focus-visible:ring-blue-500 flex-1 py-6 rounded-xl text-[15px] shadow-inner"
              />
              <Button type="submit" className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center p-0">
                <FontAwesomeIcon icon={faPaperPlane} />
              </Button>
            </form>
          </div>
        </div>

        {/* Milestones Sidebar */}
        {showMilestones && (
          <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-slate-200/80 bg-slate-50/80 flex flex-col h-1/2 md:h-full animate-in slide-in-from-right-8 duration-300">
            <div className="p-5 border-b border-slate-200/80 font-bold text-lg flex items-center gap-3 bg-white/50 backdrop-blur-md">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <FontAwesomeIcon icon={faTasks} className="text-emerald-400 text-sm" />
              </div>
              Project Milestones
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {milestones.length === 0 ? (
                <div className="text-sm text-slate-500 text-center mt-8 p-6 glass-panel rounded-2xl border-dashed border-slate-300/50">
                  <FontAwesomeIcon icon={faTasks} className="text-3xl mb-3 text-slate-400" />
                  <p>No milestones yet.</p>
                  <p className="text-xs mt-1 text-slate-400">Break your project down into steps.</p>
                </div>
              ) : (
                milestones.map(m => (
                  <div key={m.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${m.is_completed ? 'bg-emerald-900/10 border-emerald-900/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' : 'bg-white/80 border-slate-300/50 hover:border-zinc-500/50 shadow-sm'}`}>
                    <button onClick={() => toggleMilestone(m)} className="mt-0.5 flex-shrink-0 focus:outline-none group relative">
                      {m.is_completed ? (
                        <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 text-xl drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] animate-in zoom-in duration-200" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-zinc-500 group-hover:border-emerald-500 transition-colors" />
                      )}
                    </button>
                    <span className={`text-[15px] font-medium leading-tight transition-all duration-300 ${m.is_completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                      {m.title}
                    </span>
                  </div>
                ))
              )}
            </div>

            {isOwner && (
              <div className="p-5 border-t border-slate-200/80 bg-white/50 backdrop-blur-md">
                <div className="flex gap-2">
                  <Input 
                    placeholder="New milestone..."
                    value={newMilestoneTitle}
                    onChange={e => setNewMilestoneTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addMilestone(); }}
                    className="bg-slate-50 border-slate-300 rounded-xl flex-1 focus-visible:ring-emerald-500"
                  />
                  <Button onClick={addMilestone} className="rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] px-5">Add</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

    {/* Rating Modal */}
    {showRatingModal && (
      <Dialog open={showRatingModal} onOpenChange={() => {}}> 
        <DialogContent className="sm:max-w-md glass-panel-heavy border-slate-300/60 shadow-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-glow">Rate Your Experience</DialogTitle>
            <DialogDescription className="text-center text-slate-600 mt-2">
              Please rate your collaboration. This replaces the traditional escrow system with community trust!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-4 py-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-5xl transition-all hover:scale-110 focus:outline-none ${star <= rating ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'text-slate-400'}`}
              >
                ★
              </button>
            ))}
          </div>
          <Button 
            onClick={submitRating}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-7 rounded-xl text-lg font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
          >
            Submit Rating & Close
          </Button>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
