import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faUpload } from "@fortawesome/free-solid-svg-icons";
import { InnovatorMetadata, stringifyProfileMetadata } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TechInnovatorForm({ user, role }: { user: any, role: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<"student" | "self_finance" | "organization" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: user?.user_metadata?.full_name || '',
    institution_name: '',
    institution_website: '',
    portfolio: '',
    years_of_experience: '',
    domain_interests: '',
    location: '',
    organization_gst: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setIsProcessing(true);


    try {
      const metadata: InnovatorMetadata = {
        bioText: "",
        category,
        institution_name: formData.institution_name,
        institution_website: formData.institution_website,
        portfolio: formData.portfolio,
        years_of_experience: formData.years_of_experience,
        domain_interests: formData.domain_interests,
        organization_gst: formData.organization_gst,
        profile_image: "mock_avatar_url"
      };

      await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: "Domain interests: " + formData.domain_interests,
          userId: user.id
        })
      });

      await supabase.from("users").upsert({
        id: user.id,
        name: formData.name,
        role: role,
        location: formData.location,
        bio: stringifyProfileMetadata(metadata),
        document_url: "mock_url"
      });
      
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
        <h3 className="text-2xl font-bold mb-3 text-slate-900">Select Your Category</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full px-2">
          <Button onClick={() => setCategory('student')} variant="outline" className="h-24 flex flex-col hover:border-blue-500 hover:text-blue-600">
            <span className="font-bold text-lg">Student</span>
          </Button>
          <Button onClick={() => setCategory('self_finance')} variant="outline" className="h-24 flex flex-col hover:border-emerald-500 hover:text-emerald-600">
            <span className="font-bold text-lg">Self Finance</span>
          </Button>
          <Button onClick={() => setCategory('organization')} variant="outline" className="h-24 flex flex-col hover:border-indigo-500 hover:text-indigo-600">
            <span className="font-bold text-lg">Organization</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 animate-in fade-in slide-in-from-right-8 duration-500 py-4.w-full px-4 max-h-[60vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-slate-900 capitalize">{category.replace('_', ' ')} Profile</h3>
        <Button variant="ghost" type="button" onClick={() => setCategory(null)} className="text-sm">Change Category</Button>
      </div>

      <Input name="name" placeholder="Full Name / Org Name" value={formData.name} onChange={handleChange} required className="py-6 bg-slate-50" />
      
      <Input name="location" placeholder="Location" value={formData.location} onChange={handleChange} required className="py-6 bg-slate-50" />

      ((category === 'student' || category === 'organization') && (
        <Input name="institution_name" placeholder={category === 'student' ? "Institution Name" : "Organization Name"} value={formData.institution_name} onChange={handleChange} required className="py-6 bg-slate-50" />
      ))
	      
      ((category === 'student' || category === 'organization') && (
        <Input name="institution_website" placeholder="Website (Optional)" value={formData.institution_website} onChange={handleChange} className="py-6 bg-slate-50" />
      ))

      ((category === 'student' || category === 'self_finance') && (
        <>
          <Input name="portfolio" placeholder="Portfolio URL (Optional)" value={formData.portfolio} onChange={handleChange} className="py-6 bg-slate-50" />
          <Input name="years_of_experience" placeholder="Years of Experience" value={formData.years_of_experience} onChange={handleChange} required className="py-6 bg-slate-50" />
        </>
      ))

      {category === 'organization' && (
        <Input name="organization_gst" placeholder="Organization GST No (Optional)" value={formData.organization_gst} onChange={handleChange} className="py-6 bg-slate-50" />
      )}

      <Input name="domain_interests" placeholder="Domain Interests (e.g. AI,  Robotics)" value={formData.domain_interests} onChange={handleChange} required className="py-6 bg-slate-50" />

      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 mt-4 relative hover:border-blue-500 transition-colors">
        <FontAwesomeIcon icon={faUpload} className="text-3xl text-slate-400 mb-2" />
        <p className="text-sm text-slate-600 font-medium">Click to upload Profile Image / Logo</p>
        <Input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
      </div>

      ((category === 'student' || category === 'self_finance') && (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 relative mt-2 hover:border-blue-500 transition-colors">
          <FontAwesomeIcon icon={faUpload} className="text-3xl text-slate-400 mb-2" />
          <p className="text-sm text-slate-600 font-medium">Click to upload Resume (PDF)</p>
          <Input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".pdf,.doc,.docx" />
        </div>
      ))

      <Button type="submit" disabled={isProcessing} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg">
        {isProcessing ? <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xl" /> : "Complete Profile"}
      </Button>
    </form>
  );
}