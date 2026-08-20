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
import { SplashScreen } from "@/components/SplashScreen";

export default function AuthPage() {
  const [showSplash, setShowSplash] = useState(true);
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

  const handleGoogleAuth = async () => {
    setIsSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      alert("Error logging in with Google: " + error.message);
      setIsSigningIn(false);
    }
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

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-sans">
        {/* Animated abstract background blobs */}
        <div className="absolute top-0 left-[-10%] w-96 h-96 bg-blue-600/40 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-[-10%] w-96 h-96 bg-emerald-600/30 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl animate-blob animation-delay-4000"></div>

        <Card className="w-full max-w-md glass-panel-heavy text-slate-900 relative z-10 transition-transform duration-500 hover:scale-[1.01]">
          <CardHeader className="text-center space-y-4 pt-8">
            <CardTitle className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent text-glow">
              Hand2Tech
            </CardTitle>
            <CardDescription className="text-slate-600 text-lg font-medium">
              Connect to build the future.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4 pb-8">
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-5">
              <div className="relative group">
                <Input 
                  type="email" 
                  placeholder="Email address" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-slate-50/50 border-slate-300/50 py-6 text-md focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition-all rounded-xl"
                  required
                />
              </div>
              <div className="relative group">
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-slate-50/50 border-slate-300/50 py-6 text-md focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all rounded-xl"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSigningIn}
                className="relative overflow-hidden w-full py-7 text-lg bg-zinc-100 hover:bg-white text-zinc-900 font-bold transition-all rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] mt-2 group"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                {isSigningIn ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl" />
                ) : (
                  <span className="relative z-10 flex items-center justify-center">
                    Continue with Email
                  </span>
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-300/50"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white/40 px-2 text-slate-600 backdrop-blur-xl">Or</span>
              </div>
            </div>

            <Button 
              type="button" 
              onClick={handleGoogleAuth}
              disabled={isSigningIn}
              className="relative overflow-hidden w-full py-7 text-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-900 font-bold transition-all rounded-xl shadow-lg mt-2 group"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <span className="relative z-10 flex items-center justify-center gap-3">
                <FontAwesomeIcon icon={faGoogle} className="text-xl" />
                Continue with Google
              </span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-sans">
       {/* Background */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-gradient-to-tr from-blue-600/30 to-emerald-600/30 rounded-full blur-[120px] -z-10 animate-blob" />
       
      <Card className="w-full max-w-xl glass-panel-heavy text-slate-900 relative z-10 transition-all duration-500 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 animate-[shimmer_3s_infinite]" />
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-4xl font-extrabold text-glow">Complete Your Profile</CardTitle>
          <CardDescription className="text-slate-600 text-md mt-2">
            {onboardingStep === 1 ? "How will you use Hand2Tech?" : "Show us your skills"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          {onboardingStep === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              <button
                type="button"
                onClick={() => { setRole("student"); setOnboardingStep(2); }}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-slate-300/50 bg-white/40 hover:bg-slate-100/60 hover:border-blue-500/80 transition-all group shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:-translate-y-1"
              >
                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]">
                  <FontAwesomeIcon icon={faLaptopCode} className="text-4xl text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                </div>
                <div className="text-center mt-2">
                  <h3 className="font-bold text-xl text-slate-900 group-hover:text-blue-300 transition-colors">Tech Innovator</h3>
                  <p className="text-sm text-slate-600 mt-2">I code, design, or engineer digital solutions.</p>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => { setRole("laborer"); setOnboardingStep(2); }}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-slate-300/50 bg-white/40 hover:bg-slate-100/60 hover:border-emerald-500/80 transition-all group shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:-translate-y-1"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]">
                  <FontAwesomeIcon icon={faHammer} className="text-4xl text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                </div>
                <div className="text-center mt-2">
                  <h3 className="font-bold text-xl text-slate-900 group-hover:text-emerald-300 transition-colors">Skilled Craftsman</h3>
                  <p className="text-sm text-slate-600 mt-2">I build, weld, fabricate, or do physical labor.</p>
                </div>
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center max-w-md">
                <h3 className="text-2xl font-bold mb-3 text-glow">
                  Upload your {role === 'student' ? 'Resume' : 'Trade Certificate'}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Our AI will instantly analyze your document to highlight your top skills and match you with the perfect projects.
                </p>
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl border-slate-300/60 bg-white/30 hover:bg-slate-100/50 hover:border-emerald-500/60 transition-all cursor-pointer group shadow-inner">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isProcessing ? (
                     <div className="relative">
                       <FontAwesomeIcon icon={faSpinner} className="text-5xl text-emerald-400 animate-spin mb-4 relative z-10" />
                       <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full"></div>
                     </div>
                  ) : (
                    <div className="w-16 h-16 bg-slate-100/80 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all shadow-lg border border-slate-300/50">
                      <svg className="w-8 h-8 text-slate-600 group-hover:text-emerald-400 transition-colors" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                    </div>
                  )}
                  <p className="mb-2 text-md text-slate-600 text-center">
                    <span className="font-bold text-slate-800 group-hover:text-emerald-300 transition-colors">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-500 font-medium">PDF, DOCX, or PNG (MAX. 5MB)</p>
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
                <div className="text-emerald-400 text-md font-medium animate-pulse text-center tracking-wide">
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
