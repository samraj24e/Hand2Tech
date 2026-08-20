"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faTimes, faSpinner, faPaperclip, faTasks, faCheckCircle, faCircle } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

export function ChatModal({ connection, currentUser, onClose }: { connection: any, currentUser: any, onClose: () => void }) {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText("");
    
    await supabase.from("messages").insert({
      connection_id: connection.id,
      sender_id: currentUser.id,
      text: msg
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
    await supabase.from("connections").update({ status: 'rejected' }).eq("id", connection.id);
    onClose();
  };

  if (loading) {
    return (
      <Dialog open={!!connection} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100 flex justify-center p-10">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-blue-500" />
        </DialogContent>
      </Dialog>
    );
  }

  const isOwner = connection?.owner_id === currentUser?.id;

  return (
    <Dialog open={!!connection} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl bg-zinc-900 border-zinc-800 text-zinc-100 p-0 overflow-hidden flex flex-col md:flex-row h-[600px]">
        
        {/* Main Chat Area */}
        <div className={`flex flex-col h-full flex-1 transition-all ${showMilestones ? 'w-2/3' : 'w-full'}`}>
          <DialogHeader className="p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Project Chat</DialogTitle>
                <DialogDescription className="text-zinc-400">Secure realtime communication</DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMilestones(!showMilestones)} className="bg-zinc-800 border-zinc-700">
                  <FontAwesomeIcon icon={faTasks} className="mr-2" /> Milestones
                </Button>
                <Button variant="destructive" size="sm" onClick={closeProject} className="bg-red-600 hover:bg-red-700 text-white">
                  <FontAwesomeIcon icon={faTimes} className="mr-2" /> Close
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950">
            {messages.map((m, i) => {
              const isMe = m.sender_id === currentUser.id;
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-zinc-800 text-zinc-100 rounded-bl-none'}`}>
                    <div className="break-words">{m.text}</div>
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs bg-black/20 px-2 py-1 rounded hover:bg-black/40 underline">
                        View Attachment
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-zinc-900">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <label className={`flex items-center justify-center px-4 py-2 bg-zinc-800 rounded-md border border-zinc-700 cursor-pointer hover:bg-zinc-700 transition ${uploading ? 'opacity-50' : ''}`}>
                <FontAwesomeIcon icon={uploading ? faSpinner : faPaperclip} className={uploading ? 'animate-spin' : ''} />
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              
              <Input 
                value={text} 
                onChange={e => setText(e.target.value)} 
                placeholder="Type your message..."
                className="bg-zinc-800 border-zinc-700 focus-visible:ring-blue-500 flex-1"
              />
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <FontAwesomeIcon icon={faPaperPlane} />
              </Button>
            </form>
          </div>
        </div>

        {/* Milestones Sidebar */}
        {showMilestones && (
          <div className="w-1/3 border-l border-zinc-800 bg-zinc-900/80 flex flex-col h-full hidden md:flex">
            <div className="p-4 border-b border-zinc-800 font-semibold flex items-center gap-2">
              <FontAwesomeIcon icon={faTasks} className="text-emerald-500" /> Project Milestones
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {milestones.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center mt-4">No milestones yet.</div>
              ) : (
                milestones.map(m => (
                  <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <button onClick={() => toggleMilestone(m)} className="mt-0.5 flex-shrink-0 focus:outline-none">
                      <FontAwesomeIcon icon={m.is_completed ? faCheckCircle : faCircle} className={m.is_completed ? 'text-emerald-500 text-lg' : 'text-zinc-500 text-lg'} />
                    </button>
                    <span className={`text-sm ${m.is_completed ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>
                      {m.title}
                    </span>
                  </div>
                ))
              )}
            </div>

            {isOwner && (
              <div className="p-4 border-t border-zinc-800">
                <div className="flex gap-2">
                  <Input 
                    placeholder="New milestone..."
                    value={newMilestoneTitle}
                    onChange={e => setNewMilestoneTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addMilestone(); }}
                    className="bg-zinc-800 border-zinc-700 text-sm"
                  />
                  <Button onClick={addMilestone} size="sm" className="bg-emerald-600 hover:bg-emerald-700">Add</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
