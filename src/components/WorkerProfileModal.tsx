import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faUserCircle, faBriefcase, faFilePdf, faLink, faMapMarkerAlt, faStar, faTools } from "@fortawesome/free-solid-svg-icons";
import { parseProfileMetadata } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface WorkerProfileModalProps {
  worker: any;
  onClose: () => void;
  onRequestConnect: (id: string) => void;
}

export function WorkerProfileModal({ worker, onClose, onRequestConnect }: WorkerProfileModalProps) {
  if (!worker) return null;

  const metadata = parseProfileMetadata(worker.bio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-8">
        
        {/* Header Banner */}
        <div className="h-32 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-3xl relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-8 pb-8 -mt-12 relative">
          <div className="w-24 h-24 rounded-2xl bg-white shadow-xl flex items-center justify-center border-4 border-white mb-4">
            <FontAwesomeIcon icon={faUserCircle} className="text-6xl text-slate-300" />
          </div>

          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900">{worker.name}</h2>
              <p className="text-lg text-emerald-600 font-semibold capitalize tracking-wide">
                {worker.role} {metadata.specialty && <span className="text-slate-500 font-medium ml-2 text-sm px-3 py-1 bg-slate-100 rounded-full">{metadata.specialty}</span>}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-amber-500">
                <FontAwesomeIcon icon={faStar} className="mr-1" /> {Number(worker.rating || 5.0).toFixed(1)}
              </div>
              {worker.location && (
                <div className="text-slate-500 font-medium text-sm mt-1">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1" /> {worker.location}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Bio */}
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">About</h3>
              <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                {metadata.bioText || "No bio provided."}
              </p>
            </div>

            {/* Experience & Works Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faBriefcase} /> Experience
                </h3>
                <p className="text-slate-800 font-medium">{metadata.years_of_experience || "Not specified"}</p>
              </div>
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <FontAwesomeIcon icon={faTools} /> Previous Works
                </h3>
                <p className="text-slate-800 font-medium line-clamp-2">{metadata.previous_works || "Not specified"}</p>
              </div>
            </div>

            {/* Skills */}
            {worker.skills && Array.isArray(worker.skills) && worker.skills.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Skills & Expertise</h3>
                <div className="flex flex-wrap gap-2">
                  {worker.skills.map((skill: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold border border-slate-200">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(metadata.portfolio || metadata.resume_link) && (
              <div className="flex gap-4 pt-2">
                {metadata.portfolio && (
                  <a href={metadata.portfolio} target="_blank" rel="noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full rounded-xl py-6 border-slate-300 hover:border-emerald-500 hover:text-emerald-600">
                      <FontAwesomeIcon icon={faLink} className="mr-2" /> View Portfolio
                    </Button>
                  </a>
                )}
                {metadata.resume_link && (
                  <a href={metadata.resume_link} target="_blank" rel="noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full rounded-xl py-6 border-slate-300 hover:border-emerald-500 hover:text-emerald-600">
                      <FontAwesomeIcon icon={faFilePdf} className="mr-2" /> View Resume
                    </Button>
                  </a>
                )}
              </div>
            )}

            {/* Reviews */}
            {metadata.reviews && metadata.reviews.length > 0 && (
              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Client Reviews</h3>
                <div className="space-y-4">
                  {metadata.reviews.map((rev, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-800">{rev.reviewer}</span>
                        <div className="text-amber-500 font-bold text-sm">
                          {Array(rev.rating).fill("★").join("")}{Array(5 - rev.rating).fill("☆").join("")}
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm italic">"{rev.text}"</p>
                      {rev.date && <p className="text-xs text-slate-400 mt-2">{new Date(rev.date).toLocaleDateString()}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action */}
            <div className="pt-6 border-t border-slate-100">
              <Button onClick={() => onRequestConnect(worker.id)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-7 rounded-2xl text-lg shadow-[0_10px_20px_rgba(16,185,129,0.2)] transition-transform hover:-translate-y-1">
                Request to Connect for Project
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
