"use client";

import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const endTimer = setTimeout(() => {
      onComplete();
    }, 5000); // total 5 seconds
    
    return () => {
      clearTimeout(endTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 overflow-hidden">
      <div className="relative flex flex-col items-center justify-center w-full max-w-2xl">
        
        {/* Handshake Container */}
        <div className="relative w-64 h-40 flex items-center justify-center animate-in fade-in zoom-in duration-700">
          <div style={{ animation: 'nokiaShake 2s ease-in-out infinite' }}>
            <FontAwesomeIcon icon={faHandshake} className="text-[7rem] text-blue-600 drop-shadow-md" />
          </div>
        </div>

        {/* Hand2Tech Logo */}
        <h1 
          className="mt-4 text-5xl font-extrabold bg-gradient-to-r from-blue-500 via-emerald-500 to-green-600 bg-clip-text text-transparent drop-shadow-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both"
        >
          Hand2Tech
        </h1>

      </div>
    </div>
  );
}
