"use client";

import { useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5000); // 5 seconds
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 overflow-hidden">
      <div className="relative flex flex-col items-center justify-center w-full max-w-2xl">
        
        {/* Handshake Container */}
        <div 
          className="relative w-40 h-40 flex items-center justify-center"
          style={{
            animation: 'nokiaShake 1.5s ease-in-out forwards',
            animationDelay: '1.5s' // Starts exactly when the hands meet
          }}
        >
          
          {/* Left Half (Student) */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ 
              clipPath: 'inset(0 50% 0 0)', 
              animation: 'slideLeftHalf 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' 
            }}
          >
            <FontAwesomeIcon icon={faHandshake} className="text-8xl text-blue-500 drop-shadow-md" />
          </div>

          {/* Right Half (Craftsmen) */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ 
              clipPath: 'inset(0 0 0 50%)', 
              animation: 'slideRightHalf 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' 
            }}
          >
            <FontAwesomeIcon icon={faHandshake} className="text-8xl text-emerald-500 drop-shadow-md" />
          </div>

        </div>

        {/* Hand2Tech Logo */}
        <h1 
          className="mt-4 text-5xl font-extrabold bg-gradient-to-r from-blue-500 via-emerald-500 to-green-600 bg-clip-text text-transparent drop-shadow-md"
          style={{ 
            opacity: 0, 
            animation: 'popText 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            animationDelay: '1.5s' 
          }}
        >
          Hand2Tech
        </h1>

      </div>
    </div>
  );
}
