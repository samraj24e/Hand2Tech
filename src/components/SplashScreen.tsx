"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake, faHand } from "@fortawesome/free-solid-svg-icons";

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
        <div className="relative w-40 h-40 flex items-center justify-center">
          
          {!isMet ? (
            <>
              {/* Approaching Left Hand */}
              <div 
                className="absolute flex items-center justify-center"
                style={{ animation: 'slideLeftFull 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
              >
                <FontAwesomeIcon icon={faHand} className="text-8xl text-blue-500 drop-shadow-md rotate-90" />
              </div>

              {/* Approaching Right Hand */}
              <div 
                className="absolute flex items-center justify-center"
                style={{ animation: 'slideRightFull 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
              >
                <FontAwesomeIcon icon={faHand} className="text-8xl text-emerald-500 drop-shadow-md -rotate-90 scale-y-[-1]" />
              </div>
            </>
          ) : (
            /* Connected Handshake */
            <div 
              className="absolute flex items-center justify-center"
              style={{ animation: 'nokiaShake 1.5s ease-in-out forwards' }}
            >
              <FontAwesomeIcon icon={faHandshake} className="text-8xl text-blue-600 drop-shadow-md" />
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
