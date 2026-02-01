
import React from 'react';
import { GroundingSource } from '../types';

interface SourceCardProps {
  source: GroundingSource;
}

const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  return (
    <a
      href={source.uri}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white rounded-lg text-slate-400 border border-slate-200 group-hover:text-blue-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-[13px] font-bold text-slate-800 truncate">{source.title}</span>
          <span className="text-[10px] text-slate-400 truncate tracking-tight">{source.uri}</span>
        </div>
      </div>
      <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    </a>
  );
};

export default SourceCard;
