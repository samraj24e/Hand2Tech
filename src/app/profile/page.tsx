"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faSave, faSpinner, faTimes } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="text-zinc-400 hover:text-white">
          <FontAwesomeIcon icon={faArrowLeft} className="mr-2" /> Back to Dashboard
        </Button>

        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Edit Profile</CardTitle>
            <CardDescription className="text-zinc-400">
              Update your personal information and skills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Name</label>
                <Input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Location</label>
                <Input 
                  placeholder="e.g. San Francisco, CA"
                  value={location} 
                  onChange={e => setLocation(e.target.value)} 
                  className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Bio</label>
                <Textarea 
                  placeholder="A short summary about you and your experience..."
                  value={bio} 
                  onChange={e => setBio(e.target.value)} 
                  className="bg-zinc-950 border-zinc-800 min-h-[100px] focus-visible:ring-blue-500" 
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium text-zinc-300">Technical Skills</label>
                
                <div className="flex flex-wrap gap-2 mb-2">
                  {skills.map((skill, idx) => (
                    <span key={idx} className="flex items-center px-3 py-1 rounded-md bg-zinc-800 text-sm font-medium text-zinc-200 border border-zinc-700">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="ml-2 text-zinc-400 hover:text-red-400">
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && <span className="text-zinc-500 text-sm italic">No skills added yet.</span>}
                </div>

                <div className="flex gap-2">
                  <Input 
                    placeholder="Add a new skill (e.g. React, Welding)"
                    value={newSkill} 
                    onChange={e => setNewSkill(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500" 
                  />
                  <Button type="button" onClick={addSkill} variant="secondary" className="bg-zinc-800 hover:bg-zinc-700">Add</Button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-lg">
                  {saving ? <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" /> : <FontAwesomeIcon icon={faSave} className="mr-2" />}
                  Save Profile
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
