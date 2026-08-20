"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { faHammer, faLaptopCode, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"student" | "laborer" | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          checkUserProfile(session.user.id);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (data && data.role) {
      router.push("/dashboard");
    } else {
      setLoading(false);
    }
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSigningIn(true);
    
    // First try to sign in
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      if (signInError.message.includes("Invalid login credentials")) {
        // If credentials invalid, they might need to sign up
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) {
          alert("Error signing up: " + signUpError.message);
        } else {
          alert("Account created! If you have email confirmations enabled in Supabase, please check your email. Otherwise, you are logged in!");
        }
      } else {
        alert("Error: " + signInError.message);
      }
    }
    setIsSigningIn(false);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    // In a real app we'd upload to Supabase Storage:
    // const { data } = await supabase.storage.from('documents').upload(`${user.id}/${file.name}`, file)
    
    // For this MVP, we simulate reading text for the Groq API
    const text = "Simulated extracted text from " + file.name + " containing skills like React, Node, Welding, Carpentry.";
    
    // Call our AI parsing endpoint
    try {
      await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: text,
          userId: user.id
        })
      });
      
      // Complete Onboarding
      await supabase.from("users").upsert({
        id: user.id,
        name: user.user_metadata?.full_name || user.email,
        role: role,
        document_url: "mock_url"
      });
      
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
        {/* Abstract background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>

        <Card className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border-zinc-800 text-zinc-100 shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Hand2Tech
            </CardTitle>
            <CardDescription className="text-zinc-400 text-lg">
              Connect to build the future.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
              <Input 
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-zinc-950 border-zinc-800 py-6"
                required
              />
              <Input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-zinc-950 border-zinc-800 py-6"
                required
              />
              <Button 
                type="submit" 
                disabled={isSigningIn}
                className="w-full py-6 text-lg bg-zinc-100 hover:bg-white text-zinc-900 font-semibold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                {isSigningIn ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-xl" />
                ) : (
                  "Continue with Email"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
       {/* Background */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-gradient-to-tr from-blue-900/20 to-emerald-900/20 rounded-full blur-[100px] -z-10" />
       
      <Card className="w-full max-w-xl bg-zinc-900/80 backdrop-blur-2xl border-zinc-800 text-zinc-100 shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-emerald-500" />
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription className="text-zinc-400">
            {onboardingStep === 1 ? "How will you use Hand2Tech?" : "Show us your skills"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {onboardingStep === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => { setRole("student"); setOnboardingStep(2); }}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/80 hover:border-blue-500 transition-all group"
              >
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FontAwesomeIcon icon={faLaptopCode} className="text-3xl text-blue-400" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg text-zinc-200">Tech Innovator</h3>
                  <p className="text-sm text-zinc-400 mt-1">I code, design, or engineer digital solutions.</p>
                </div>
              </button>
              
              <button
                onClick={() => { setRole("laborer"); setOnboardingStep(2); }}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/80 hover:border-emerald-500 transition-all group"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FontAwesomeIcon icon={faHammer} className="text-3xl text-emerald-400" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg text-zinc-200">Skilled Craftsman</h3>
                  <p className="text-sm text-zinc-400 mt-1">I build, weld, fabricate, or do physical labor.</p>
                </div>
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center max-w-sm">
                <h3 className="text-xl font-medium mb-2">
                  Upload your {role === 'student' ? 'Resume' : 'Trade Certificate'}
                </h3>
                <p className="text-zinc-400 text-sm">
                  Our AI will instantly analyze your document to highlight your top skills and match you with projects.
                </p>
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl border-zinc-700 bg-zinc-800/20 hover:bg-zinc-800/50 hover:border-blue-500 transition-all cursor-pointer group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isProcessing ? (
                     <FontAwesomeIcon icon={faSpinner} className="text-4xl text-blue-500 animate-spin mb-4" />
                  ) : (
                    <svg className="w-10 h-10 mb-4 text-zinc-500 group-hover:text-blue-400 transition-colors" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                  )}
                  <p className="mb-2 text-sm text-zinc-400">
                    <span className="font-semibold text-zinc-200">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-zinc-500">PDF, DOCX, or PNG (MAX. 5MB)</p>
                </div>
                <Input 
                  id="dropzone-file" 
                  type="file" 
                  className="hidden" 
                  onChange={handleDocumentUpload}
                  disabled={isProcessing}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" 
                />
              </label>

              {isProcessing && (
                <div className="text-blue-400 text-sm animate-pulse text-center">
                  Analyzing document with Groq AI...<br/>Extracting technical skills...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
