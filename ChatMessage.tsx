
import React, { useState } from 'react';
import { Message } from '../types';
import SourceCard from './SourceCard';

interface ChatMessageProps {
  message: Message;
  onPlayAudio?: () => void;
  isSpeakingThis?: boolean;
  isVoiceLoading?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPlayAudio, isSpeakingThis, isVoiceLoading }) => {
  const isUser = message.role === 'user';
  const [showSources, setShowSources] = useState(false);

  if (isUser) {
    return (
      <div className="flex w-full flex-col items-end mb-8 animate-in slide-in-from-right-4 duration-500">
        <div className="max-w-[85%] bg-slate-900 text-white px-6 py-4 rounded-[28px] rounded-tr-none shadow-xl">
          <p className="text-[15px] font-semibold tracking-tight">{message.content}</p>
        </div>
        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 mt-2">
            {message.images.map((img, i) => (
              <img key={i} src={img} className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-md" />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col mb-10 animate-in slide-in-from-left-4 duration-500">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-blue-200">G</div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Grounding Results</span>
        </div>
        {onPlayAudio && (
          <button 
            onClick={onPlayAudio} 
            disabled={isVoiceLoading}
            className={`p-2 rounded-full transition-all border ${isSpeakingThis ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400 hover:text-slate-900'}`}
          >
            {isVoiceLoading ? (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            ) : isSpeakingThis ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
            )}
          </button>
        )}
      </div>
      
      <div className="bg-white border border-slate-100 p-6 rounded-[28px] rounded-tl-none shadow-sm ring-1 ring-slate-50 relative group">
        <div className="prose prose-slate max-w-none text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">
          {message.content}
        </div>

        {message.images && message.images.length > 0 && (
          <div className="mt-6 space-y-3">
            {message.images.map((img, i) => (
              <img 
                key={i} 
                src={img} 
                alt="Synthesis Output" 
                className="rounded-2xl w-full max-h-[500px] object-cover shadow-2xl border border-slate-100"
              />
            ))}
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-50">
            <button 
              onClick={() => setShowSources(!showSources)}
              className="text-[11px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${showSources ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              {showSources ? 'Hide Citations' : `Explore ${message.sources.length} Data Sources`}
            </button>
            {showSources && (
              <div className="mt-4 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
                {message.sources.map((s, i) => <SourceCard key={i} source={s} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
