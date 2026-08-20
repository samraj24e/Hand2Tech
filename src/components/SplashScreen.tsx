"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/free-solid-svg-icons";

const ReachingHand = ({ className, flipped = false }: { className?: string, flipped?: boolean }) => (
  <svg viewBox="0 0 100 50" className={className} style={{ transform: flipped ? 'scaleX(-1)' : 'none' }}>
    {/* Sleeve */}
    <path d="M -10,5 L 30,5 L 30,40 L -10,40 Z" fill="currentColor" opacity="0.9" />
    {/* Hand/Fingers */}
    <path d="M 25,12 Q 60,12 70,18 Q 95,18 95,25 Q 95,33 70,33 L 25,33 Z" fill="currentColor" opacity="0.75" />
    {/* Thumb */}
    <path d="M 35,12 Q 55,-5 65,5 Q 75,15 60,18 Z" fill="currentColor" opacity="0.75" />
  </svg>
);

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isMet, setIsMet] = useState(false);

  useEffect(() => {
    const meetTimer = setTimeout(() => {
      setIsMet(true);
    }, 1500); // exactly when sliding finishes
    
    const endTimer = setTimeout(() => {
      onComplete();
    }, 5000); // total 5 seconds
    
    return () => {
      clearTimeout(meetTimer);
      clearTimeout(endTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 overflow-hidden">
      <div className="relative flex flex-col items-center justify-center w-full max-w-2xl">
        
        {/* Handshake Container */}
        <div className="relative w-64 h-40 flex items-center justify-center">
          
          {!isMet ? (
            <>
              {/* Approaching Left Hand */}
              <div 
                className="absolute left-0 flex items-center justify-center w-32 h-32"
                style={{ animation: 'slideLeftFull 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
              >
                <ReachingHand className="w-full h-full text-blue-600 drop-shadow-md" />
              </div>

              {/* Approaching Right Hand */}
              <div 
                className="absolute right-0 flex items-center justify-center w-32 h-32"
                style={{ animation: 'slideRightFull 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
              >
                <ReachingHand className="w-full h-full text-emerald-600 drop-shadow-md" flipped />
              </div>
            </>
          ) : (
            /* Connected Handshake */
            <div 
              className="absolute flex items-center justify-center"
              style={{ animation: 'nokiaShake 1.5s ease-in-out forwards' }}
            >
              <FontAwesomeIcon icon={faHandshake} className="text-[7rem] text-blue-600 drop-shadow-md" />
            </div>
          )}

        </div>

        {/* Hand2Tech Logo */}
        <h1 
          className="mt-4 text-5xl font-extrabold bg-gradient-to-r from-blue-500 via-emerald-500 to-green-600 bg-clip-text text-transparent drop-shadow-md"
          style={{ 
            opacity: isMet ? 1 : 0, 
            transition: 'opacity 0.5s ease-in-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: isMet ? 'scale(1)' : 'scale(0.8)'
          }}
        >
          Hand2Tech
        </h1>

      </div>
    </div>
  );
}
