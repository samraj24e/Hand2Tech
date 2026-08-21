"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faUserCircle, faArrowLeft, faSave, faTimes, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
import { parseProfileMetadata, stringifyProfileMetadata, InnovatorMetadata } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Base fields
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  // Extended Metadata fields
  const [metadata, setMetadata] = useState<InnovatorMetadata>({ bioText: "" });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
      } else {
        loadProfile(session.user.id);
      }
    };
    checkUser();
  }, [router]);

  const loadProfile = async (userId: string) => {
    const { data: profile } = await supabase.from("users").select("*").eq("id", userId).single();
    if (profile) {
      setUser(profile);
      setName(profile.name || "");
      setLocation(profile.location || "");
      setPhone(profile.phone || "");
      setSkills(profile.skills || []);
      
      const parsedMeta = parseProfileMetadata(profile.bio);
      setMetadata(parsedMeta);
      setBio(parsedMeta.bioText || "");
    }
    setLoading(false);
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMetadata(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    const finalMetadata = { ...metadata, bioText: bio };
    
    const { error } = await supabase.from("users").update({
      name,
      location,
      bio: stringifyProfileMetadata(finalMetadata),
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

  if (loading) return <div className="min-h-screen relative" />;

  const cat = metadata.category;

  return (
    <div className="min-h-screen font-sans p-4 lg:p-12 relative overflow-hidden">
      <div className="max-w-3xl mx-auto space-y-8 relative z-10">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-xl px-5 transition-all hover:bg-slate-50 hover:-translate-x-1 shadow-sm">
          <FontAwesomeIcon icon={faArrowLeft} className="mr-3" /> Back to Dashboard
        </Button>

        <Card className="glass-panel-heavy overflow-hidden shadow-md border border-slate-200">
          <CardHeader className="pt-10 pb-6 px-10">
            <CardTitle className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <FontAwesomeIcon icon={faUserCircle} className="text-blue-500" /> Edit Profile
            </CardTitle>
            <CardDescription className="text-slate-600 text-md mt-2">
              Update your personal information and technical skills to find better matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <form onSubmit={handleSave} className="space-y-8">
              
              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="bg-white border-slate-300 focus-visible:ring-blue-500 py-6 rounded-xl shadow-inner transition-all" />
              </div>

              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase flex items-center gap-2">
                  Location <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-500" />
                </label>
                <Input placeholder="e.g. San Francisco, CA" value={location} onChange={e => setLocation(e.target.value)} className="bg-white border-slate-300 focus-visible:ring-emerald-500 py-6 rounded-xl shadow-inner transition-all" />
              </div>

              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Bio</label>
                <Textarea placeholder="A short summary about you and your experience..." value={bio} onChange={e => setBio(e.target.value)} className="bg-white border-slate-300 min-h-[120px] focus-visible:ring-indigo-500 rounded-xl shadow-inner transition-all p-4 resize-none" />
              </div>

              <div className="space-y-3 group">
                <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Phone Number</label>
                <Input placeholder="e.g. +91 9876543210 (For WhatsApp Match Alerts)" value={phone} onChange={e => setPhone(e.target.value)} className="bg-white border-slate-300 focus-visible:ring-blue-500 py-6 rounded-xl shadow-inner transition-all" />
              </div>

              {user?.role === 'student' && (
                <div className="space-y-3 group">
                  <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Innovator Category</label>
                  <select 
                    name="category"
                    value={metadata.category || ""}
                    onChange={(e) => setMetadata(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full bg-white border border-slate-300 focus-visible:ring-blue-500 py-4 px-4 rounded-xl shadow-inner transition-all"
                  >
                    <option value="" disabled>Select your category...</option>
                    <option value="student">Student</option>
                    <option value="self_finance">Self Finance</option>
                    <option value="organization">Organization</option>
                  </select>
                </div>
              )}

              {cat && (
                <div className="p-6 border border-slate-200 rounded-2xl bg-slate-50 space-y-6">
                  <h4 className="text-lg font-bold text-slate-800 capitalize border-b border-slate-200 pb-2">{cat.replace('_', ' ')} Details</h4>
                  
                  {(cat === 'student' || cat === 'organization') && (
                    <div className="space-y-3 group">
                      <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">{cat === 'student' ? 'Institution Name' : 'Organization Name'}</label>
                      <Input name="institution_name" value={metadata.institution_name || ""} onChange={handleMetadataChange} className="bg-white border-slate-300 py-6 rounded-xl" />
                    </div>
                  )}

                  {(cat === 'student' || cat === 'organization') && (
                    <div className="space-y-3 group">
                      <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">{cat === 'student' ? 'Institution Website' : 'Organization Website'}</label>
                      <Input name="institution_website" value={metadata.institution_website || ""} onChange={handleMetadataChange} className="bg-white border-slate-300 py-6 rounded-xl" />
                    </div>
                  )}

                  {(cat === 'student' || cat === 'self_finance') && (
                    <>
                      <div className="space-y-3 group">
                        <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Portfolio URL</label>
                        <Input name="portfolio" value={metadata.portfolio || ""} onChange={handleMetadataChange} className="bg-white border-slate-300 py-6 rounded-xl" />
                      </div>
                      <div className="space-y-3 group">
                        <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Years of Experience</label>
                        <Input name="years_of_experience" value={metadata.years_of_experience || ""} onChange={handleMetadataChange} className="bg-white border-slate-300 py-6 rounded-xl" />
                      </div>
                      <div className="space-y-3 group">
                        <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Previous Works Summary</label>
                        <Input name="previous_works" value={metadata.previous_works || ""} onChange={handleMetadataChange} placeholder="E.g. Built 3 mobile apps, fixed 12 tractor engines" className="bg-white border-slate-300 py-6 rounded-xl" />
                      </div>
                      <div className="space-y-3 group">
                        <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Resume Link (URL)</label>
                        <Input name="resume_link" value={metadata.resume_link || ""} onChange={handleMetadataChange} placeholder="https://drive.google.com/..." className="bg-white border-slate-300 py-6 rounded-xl" />
                      </div>
                    </>
                  )}

                  {cat === 'organization' && (
                    <div className="space-y-3 group">
                      <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Organization GST No</label>
                      <Input name="organization_gst" value={metadata.organization_gst || ""} onChange={handleMetadataChange} className="bg-white border-slate-300 py-6 rounded-xl" />
                    </div>
                  )}

                  <div className="space-y-3 group">
                    <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Domain Interests</label>
                    <Input name="domain_interests" value={metadata.domain_interests || ""} onChange={handleMetadataChange} className="bg-white border-slate-300 py-6 rounded-xl" />
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white relative hover:border-blue-500 transition-colors">
                    <p className="text-sm text-slate-600 font-medium">Click to upload Profile Image / Logo</p>
                    <Input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
                  </div>

                  {(cat === 'student' || cat === 'self_finance') && (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white relative hover:border-blue-500 transition-colors">
                      <p className="text-sm text-slate-600 font-medium">Click to upload Resume (PDF)</p>
                      <Input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx" />
                    </div>
                  )}
                </div>
              )}

              {user?.role === 'laborer' && (
                <div className="p-6 border border-slate-200 rounded-2xl bg-emerald-50/50 space-y-6">
                  <h4 className="text-lg font-bold text-slate-800 capitalize border-b border-slate-200 pb-2">Craftsman Details</h4>
                  
                  <div className="space-y-3 group">
                    <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Years of Experience</label>
                    <Input name="years_of_experience" value={metadata.years_of_experience || ""} onChange={handleMetadataChange} placeholder="e.g. 10 years welding" className="bg-white border-slate-300 py-6 rounded-xl" />
                  </div>
                  
                  <div className="space-y-3 group">
                    <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Previous Works Summary</label>
                    <Input name="previous_works" value={metadata.previous_works || ""} onChange={handleMetadataChange} placeholder="E.g. Built 3 mobile apps, fixed 12 tractor engines" className="bg-white border-slate-300 py-6 rounded-xl" />
                  </div>
                  
                  <div className="space-y-3 group">
                    <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Portfolio / Website URL</label>
                    <Input name="portfolio" value={metadata.portfolio || ""} onChange={handleMetadataChange} placeholder="https://..." className="bg-white border-slate-300 py-6 rounded-xl" />
                  </div>
                  
                  <div className="space-y-3 group">
                    <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Resume Link (URL)</label>
                    <Input name="resume_link" value={metadata.resume_link || ""} onChange={handleMetadataChange} placeholder="https://drive.google.com/..." className="bg-white border-slate-300 py-6 rounded-xl" />
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4">
                <label className="text-sm font-semibold text-slate-700 tracking-wide uppercase">Technical Skills</label>
                
                <div className="flex flex-wrap gap-3 mb-4">
                  {skills.map((skill, idx) => (
                    <span key={idx} className="flex items-center px-4 py-2 rounded-full bg-white/80 text-sm font-semibold text-slate-900 border border-slate-300/80 transition-all">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="ml-3 text-slate-500 hover:text-red-400 hover:scale-110 transition-all">
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && <span className="text-slate-500 text-sm italic py-2">No skills added yet. They help us match you!</span>}
                </div>

                <div className="flex gap-3">
                  <Input placeholder="Add a new skill (e.g. React, Welding)" value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} className="bg-white border-slate-300 py-6 rounded-xl flex-1" />
                  <Button type="button" onClick={addSkill} variant="secondary" className="bg-slate-100 border border-slate-300 px-6 font-semibold h-full rounded-xl">Add</Button>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-200 mt-8">
                <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-7 rounded-xl shadow-lg transition-all">
                  {saving ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl" /> : <span className="flex items-center text-lg"><FontAwesomeIcon icon={faSave} className="mr-3" /> Save Profile Changes</span>}
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
