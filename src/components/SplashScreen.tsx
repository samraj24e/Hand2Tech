"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake, faHandSparkles, faHandHoldingHeart } from "@fortawesome/free-solid-svg-icons";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5000); // 5 seconds
    
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 overflow-hidden">
      <div className="relative flex items-center justify-center w-full max-w-2xl">
        
        {/* Left Hand: Student/Tech */}
        <div 
          className="absolute text-blue-500 z-10"
          style={{ animation: 'slideRight 4s forwards ease-in-out' }}
        >
          <div className="flex flex-col items-center">
            <FontAwesomeIcon icon={faHandSparkles} className="text-8xl drop-shadow-lg" />
            <span className="mt-4 font-bold text-xl text-blue-600">Students</span>
          </div>
        </div>

        {/* Right Hand: Employee/Laborer */}
        <div 
          className="absolute text-emerald-500 z-10"
          style={{ animation: 'slideLeft 4s forwards ease-in-out' }}
        >
          <div className="flex flex-col items-center">
            <FontAwesomeIcon icon={faHandHoldingHeart} className="text-8xl drop-shadow-lg" />
            <span className="mt-4 font-bold text-xl text-emerald-600">Craftsmen</span>
          </div>
        </div>

        {/* Center: Hand2Tech Logo */}
        <div 
          className="absolute z-20 flex flex-col items-center justify-center"
          style={{ animation: 'expandCenter 5s forwards ease-out' }}
        >
          <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-100">
            <FontAwesomeIcon icon={faHandshake} className="text-6xl text-blue-600" />
          </div>
          <h1 className="mt-6 text-5xl font-extrabold bg-gradient-to-r from-blue-500 via-emerald-500 to-green-600 bg-clip-text text-transparent text-glow">
            Hand2Tech
          </h1>
        </div>

      </div>
    </div>
  );
}
