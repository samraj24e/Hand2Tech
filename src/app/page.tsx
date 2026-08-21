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
import TechInnovatorForm from "@/components/TechInnovatorForm";

export default function AuthPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"student" | "laborer" | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const [isReturning, setIsReturning] = useState(false);

  async function checkUserProfile(userId: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setIsReturning(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSigningIn(true);
    
    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        alert("Error signing up: " + signUpError.message);
      } else {
        alert("Account created successfully! You are now logged in (or check your email for confirmation if required).");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        alert("Error signing in: " + signInError.message);
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
      <div className="flex min-h-screen items-center justify-center bg-transparent">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent p-4 relative overflow-hidden font-sans">
        {/* Animated abstract background blobs */}
        <div className="absolute top-0 left-[-10%] w-96 h-96 bg-blue-600/40 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute top-0 right-[-10%] w-96 h-96 bg-emerald-600/30 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl animate-blob animation-delay-4000"></div>

        <Card className="w-full max-w-md glass-panel-heavy text-slate-900 relative z-10 transition-transform duration-500 hover:scale-[1.01]">
          <CardHeader className="text-center space-y-4 pt-8">
            <CardTitle className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
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
                  className="bg-white border-slate-300 py-6 text-md focus-visible:ring-emerald-500 focus-visible:border-emerald-500 transition-all rounded-xl shadow-sm"
                  required
                />
              </div>
              <div className="relative group">
                <Input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-white border-slate-300 py-6 text-md focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all rounded-xl shadow-sm"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSigningIn}
                className="relative overflow-hidden w-full py-7 text-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all rounded-xl shadow-lg mt-2 group"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                {isSigningIn ? (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl" />
                ) : (
                  <span className="relative z-10 flex items-center justify-center">
                    {isSignUp ? "Create new account" : "Sign in with Email"}
                  </span>
                )}
              </Button>
              
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {isSignUp ? "Already have an account? Sign in" : "New user? Create new account"}
                </button>
              </div>
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
                <svg className="w-6 h-6" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRoleSelection = async (selectedRole: "student" | "laborer") => {
    setRole(selectedRole);
    if (isReturning) {
      setIsProcessing(true);
      await supabase.from("users").update({ role: selectedRole }).eq("id", user.id);
      router.push("/dashboard");
    } else {
      setOnboardingStep(2);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-4 relative overflow-hidden font-sans">
       {/* Background */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[500px] bg-gradient-to-tr from-blue-600/30 to-emerald-600/30 rounded-full blur-[120px] -z-10 animate-blob" />
       
      <Card className="w-full max-w-xl glass-panel-heavy text-slate-900 relative z-10 transition-all duration-500 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-indigo-500 animate-[shimmer_3s_infinite]" />
        <CardHeader className="text-center pt-8">
          <CardTitle className="text-4xl font-extrabold text-glow">
            {isReturning ? "Welcome Back!" : "Complete Your Profile"}
          </CardTitle>
          <CardDescription className="text-slate-600 text-md mt-2">
            {isReturning ? "Which role are you logging in as today?" : (onboardingStep === 1 ? "How will you use Hand2Tech?" : "Show us your skills")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          {onboardingStep === 1 && !isProcessing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              <button
                type="button"
                onClick={() => handleRoleSelection("student")}
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
                onClick={() => handleRoleSelection("laborer")}
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

          {onboardingStep === 1 && isProcessing && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in zoom-in duration-300">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-5xl text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              <h3 className="text-xl font-bold text-slate-700 animate-pulse">Switching Role...</h3>
            </div>
          )}

          {onboardingStep === 2 && role === 'student' && (
            <TechInnovatorForm user={user} role={role} />
          )}

          {onboardingStep === 2 && role === 'laborer' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center max-w-md">
                <h3 className="text-2xl font-bold mb-3 text-slate-900">
                  Upload your Trade Certificate
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
