"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSave, faSpinner, faTimes, faUserCircle, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
      } else {
        loadProfile(session.user.id);
      }
    });
  }, []);

  const loadProfile = async (userId: string) => {
    const { data: profile } = await supabase.from("users").select("*").eq("id", userId).single();
    if (profile) {
      setUser(profile);
      setName(profile.name || "");
      setLocation(profile.location || "");
      setBio(profile.bio || "");
      setPhone(profile.phone || "");
      setSkills(profile.skills || []);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    const { error } = await supabase.from("users").update({
      name,
      location,
      bio,
      phone,
      skills
    }).eq("id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated successfully!");
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-500 text-4xl" />
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 lg:p-12 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-blob" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none animate-blob animation-delay-4000" />

      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="text-zinc-400 hover:text-white bg-zinc-900/30 backdrop-blur-sm border border-zinc-800 rounded-xl px-5 transition-all hover:bg-zinc-800 hover:-translate-x-1">
          <FontAwesomeIcon icon={faArrowLeft} className="mr-3" /> Back to Dashboard
        </Button>

        <Card className="glass-panel-heavy overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 animate-[shimmer_3s_infinite]" />
          <CardHeader className="pt-10 pb-6 px-10">
            <CardTitle className="text-3xl font-extrabold text-glow tracking-tight flex items-center gap-3">
              <FontAwesomeIcon icon={faUserCircle} className="text-blue-400" /> Edit Profile
            </CardTitle>
            <CardDescription className="text-zinc-400 text-md mt-2">
              Update your personal information and technical skills to find better matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <form onSubmit={handleSave} className="space-y-8">
              
              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Name</label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="bg-zinc-950/60 border-zinc-700/60 focus-visible:ring-blue-500 py-6 rounded-xl shadow-inner transition-all group-focus-within:border-blue-500/50" 
                />
              </div>

              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-zinc-300 tracking-wide uppercase flex items-center gap-2">
                  Location <FontAwesomeIcon icon={faMapMarkerAlt} className="text-zinc-500" />
                </label>
                <Input 
                  placeholder="e.g. San Francisco, CA"
                  value={location} 
                  onChange={e => setLocation(e.target.value)} 
                  className="bg-zinc-950/60 border-zinc-700/60 focus-visible:ring-emerald-500 py-6 rounded-xl shadow-inner transition-all group-focus-within:border-emerald-500/50" 
                />
              </div>

              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Bio</label>
                <Textarea 
                  placeholder="A short summary about you and your experience..."
                  value={bio} 
                  onChange={e => setBio(e.target.value)} 
                  className="bg-zinc-950/60 border-zinc-700/60 min-h-[120px] focus-visible:ring-indigo-500 rounded-xl shadow-inner transition-all group-focus-within:border-indigo-500/50 p-4 resize-none" 
                />
              </div>

              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Phone Number</label>
                <Input 
                  placeholder="e.g. +91 9876543210 (For WhatsApp Match Alerts)"
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="bg-zinc-950/60 border-zinc-700/60 focus-visible:ring-blue-500 py-6 rounded-xl shadow-inner transition-all group-focus-within:border-blue-500/50" 
                />
              </div>

              <div className="space-y-4 pt-4">
                <label className="text-sm font-semibold text-zinc-300 tracking-wide uppercase">Technical Skills</label>
                
                <div className="flex flex-wrap gap-3 mb-4">
                  {skills.map((skill, idx) => (
                    <span key={idx} className="flex items-center px-4 py-2 rounded-full bg-zinc-900/80 text-sm font-semibold text-zinc-100 border border-zinc-700/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_0_10px_rgba(0,0,0,0.5)] transition-all animate-in zoom-in duration-200 group">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="ml-3 text-zinc-500 hover:text-red-400 hover:scale-110 transition-all focus:outline-none">
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && <span className="text-zinc-500 text-sm italic py-2">No skills added yet. They help us match you!</span>}
                </div>

                <div className="flex gap-3">
                  <Input 
                    placeholder="Add a new skill (e.g. React, Welding)"
                    value={newSkill} 
                    onChange={e => setNewSkill(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    className="bg-zinc-950/60 border-zinc-700/60 focus-visible:ring-emerald-500 py-6 rounded-xl shadow-inner transition-all flex-1" 
                  />
                  <Button type="button" onClick={addSkill} variant="secondary" className="bg-zinc-800 hover:bg-emerald-600 hover:text-white transition-all rounded-xl shadow-md border border-zinc-700 px-6 font-semibold">
                    Add
                  </Button>
                </div>
              </div>

              <div className="pt-8 border-t border-zinc-800/80 mt-8">
                <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-7 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all overflow-hidden relative group">
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                  {saving ? (
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl relative z-10" />
                  ) : (
                    <span className="flex items-center text-lg relative z-10">
                      <FontAwesomeIcon icon={faSave} className="mr-3" /> Save Profile Changes
                    </span>
                  )}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
