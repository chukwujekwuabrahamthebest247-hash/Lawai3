
import React, { useState, useRef, useEffect } from 'react';
import { Message, AppStatus, ChatSession, SourceScope, VoiceGender, LegalMethod } from './types';
import { generateAIResponse, generateSpeech, decodeAudioData } from './services/aiService';
import ChatMessage from './components/ChatMessage';

const STORAGE_KEY = 'omnisearch_v6';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [loadingVoiceIdx, setLoadingVoiceIdx] = useState<number | null>(null);
  const [scope, setScope] = useState<SourceScope>('GLOBAL');
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('FEMALE');
  const [legalMethod, setLegalMethod] = useState<LegalMethod>('NONE');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(localStorage.getItem('ext_image_url') || '');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('ext_image_url', imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed.map((s: any) => ({
          ...s,
          messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        })));
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) { createNewChat(); }
    } else createNewChat();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const createNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Search',
      messages: [{
        role: 'assistant',
        content: `OmniSearch is ready. I can perform deep Google searches, analyze documents/images, or apply legal frameworks. What can I find for you?`,
        timestamp: new Date()
      }],
      lastModified: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setErrorMessage(null);
  };

  const updateCurrentSession = (newMessages: Message[], newTitle?: string) => {
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: newMessages, title: newTitle || s.title, lastModified: Date.now() } : s));
  };

  const cacheVoiceMessage = async (index: number) => {
    const msg = messages[index];
    if (!msg || msg.role !== 'assistant' || msg.audioBuffer) return;
    try {
      const ctx = await ensureAudioContext();
      const audioData = await generateSpeech(msg.content, voiceGender);
      if (audioData) {
        const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
        const updatedMessages = [...messages];
        updatedMessages[index] = { ...msg, audioBuffer: buffer };
        updateCurrentSession(updatedMessages);
        return buffer;
      }
    } catch (e) { console.error(e); }
    return null;
  };

  const playVoiceOutput = async (index: number) => {
    try {
      if (speakingIdx !== null) stopSpeaking();
      const ctx = await ensureAudioContext();
      let buffer = messages[index].audioBuffer;
      if (!buffer) {
        setLoadingVoiceIdx(index);
        buffer = await cacheVoiceMessage(index) || undefined;
        setLoadingVoiceIdx(null);
      }
      if (buffer && ctx) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setSpeakingIdx(null);
        currentSourceRef.current = source;
        setSpeakingIdx(index);
        source.start(0);
      }
    } catch (e) { console.error(e); }
  };

  const stopSpeaking = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (e) {}
      currentSourceRef.current = null;
    }
    setSpeakingIdx(null);
  };

  // Fixed handleFileUpload to resolve type inference issues that might cause "unknown to Blob" errors
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (rev: ProgressEvent<FileReader>) => {
        const result = rev.target?.result;
        if (typeof result === 'string') {
          setAttachedImages(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const detectImageRequest = (text: string) => {
    const keywords = ['generate image', 'draw', 'create image', 'picture of'];
    return keywords.some(k => text.toLowerCase().includes(k)) && imageUrl.trim() !== '';
  };

  const handleImageGeneration = async (prompt: string) => {
    try {
      const response = await fetch(imageUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      return data.url || data.image || data.output || null;
    } catch (e) { return null; }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || status === AppStatus.LOADING) return;

    setErrorMessage(null);
    if (speakingIdx !== null) stopSpeaking();
    await ensureAudioContext();

    const userPrompt = inputValue.trim();
    const userImages = [...attachedImages];
    const userMsg: Message = { 
      role: 'user', 
      content: userPrompt, 
      timestamp: new Date(),
      images: userImages
    };
    
    const updated = [...messages, userMsg];
    updateCurrentSession(updated, messages.length <= 1 ? userPrompt.slice(0, 30) : undefined);
    
    setInputValue('');
    setAttachedImages([]);
    setStatus(AppStatus.LOADING);

    try {
      let resultText = "";
      let resultSources = [];
      let resultImages: string[] = [];

      if (detectImageRequest(userPrompt)) {
        const generatedImg = await handleImageGeneration(userPrompt);
        if (generatedImg) {
          resultImages = [generatedImg];
          resultText = `Visual synthesis complete for: ${userPrompt}`;
        } else {
          resultText = "External image generation failed.";
        }
      } else {
        const res = await generateAIResponse(userPrompt, userImages, legalMethod, scope);
        if (res.error) {
          setErrorMessage(res.error);
          setStatus(AppStatus.ERROR);
          return;
        }
        resultText = res.text;
        resultSources = res.sources || [];
      }

      const assistantMsg: Message = { 
        role: 'assistant', 
        content: resultText, 
        timestamp: new Date(), 
        sources: resultSources,
        images: resultImages
      };
      
      const final = [...updated, assistantMsg];
      updateCurrentSession(final);
      setStatus(AppStatus.IDLE);
      
      const lastIdx = final.length - 1;
      if (autoSpeak) {
        const buffer = await cacheVoiceMessage(lastIdx);
        if (buffer) playVoiceOutput(lastIdx);
      } else {
        cacheVoiceMessage(lastIdx); 
      }
    } catch (error) {
      setErrorMessage("Service failure. Please check your internet.");
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900" onClick={() => ensureAudioContext()}>
      {/* Sidebar */}
      <aside className={`h-full bg-slate-900 flex flex-col transition-all duration-300 shrink-0 ${isSidebarOpen ? 'w-72' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-white/10">
          <button onClick={createNewChat} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl transition-all text-sm font-bold shadow-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
            New Investigation
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
          <div>
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">History</h2>
            <div className="space-y-1">
              {sessions.map(s => (
                <button key={s.id} onClick={() => setCurrentSessionId(s.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${currentSessionId === s.id ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                  <div className="truncate">{s.title}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">Grounding Scope</h2>
            <div className="px-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {(['GLOBAL', 'NIGERIA'] as SourceScope[]).map(s => (
                  <button key={s} onClick={() => setScope(s)} className={`py-1.5 text-[9px] font-black rounded-lg border transition-all ${scope === s ? 'bg-white text-slate-900 border-white' : 'text-slate-500 border-slate-800 hover:border-slate-700'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">Image API URL</h2>
            <div className="px-2">
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-[11px] focus:ring-1 focus:ring-blue-500 outline-none" />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col bg-white min-w-0">
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h8m-8 6h16" /></svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-xs font-black tracking-widest uppercase text-slate-950">OmniSearch AI</h1>
              <span className="text-[9px] font-bold text-blue-600 tracking-widest">LIVE GOOGLE GROUNDING</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setAutoSpeak(!autoSpeak)} className={`text-[10px] font-black px-4 py-2 rounded-full transition-all border ${autoSpeak ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>
              VOICE: {autoSpeak ? 'ON' : 'OFF'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar px-6 py-10">
          <div className="max-w-3xl mx-auto">
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top-4">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="text-xs font-bold uppercase tracking-wide flex-1">{errorMessage}</div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={idx} 
                message={msg} 
                onPlayAudio={msg.role === 'assistant' ? () => playVoiceOutput(idx) : undefined}
                isSpeakingThis={speakingIdx === idx}
                isVoiceLoading={loadingVoiceIdx === idx}
              />
            ))}
            {status === AppStatus.LOADING && (
              <div className="flex items-center gap-4 ml-4 mb-10">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2.5 h-2.5 bg-blue-200 rounded-full animate-bounce delay-150"></div>
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Searching Google Tool...</span>
              </div>
            )}
            <div ref={scrollRef} className="h-1" />
          </div>
        </main>

        <footer className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Analysis Controls */}
            <div className="flex items-center justify-between gap-4 px-1">
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                {(['NONE', 'IRAC', 'IPAC', 'CREC'] as LegalMethod[]).map(m => (
                  <button key={m} onClick={() => setLegalMethod(m)} className={`px-4 py-1.5 text-[9px] font-bold rounded-lg transition-all ${legalMethod === m ? 'bg-white text-slate-950 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                    {m === 'NONE' ? 'GENERAL' : m}
                  </button>
                ))}
              </div>
              <select value={voiceGender} onChange={(e) => setVoiceGender(e.target.value as VoiceGender)} className="bg-slate-50 text-[10px] font-bold text-slate-900 border-slate-100 rounded-xl p-2 px-3 focus:ring-0 uppercase cursor-pointer">
                <option value="FEMALE">Voice: Kore</option>
                <option value="MALE">Voice: Fenrir</option>
              </select>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="relative group">
              {attachedImages.length > 0 && (
                <div className="flex gap-2 p-3 bg-slate-50 border-x border-t border-slate-200 rounded-t-[28px] animate-in slide-in-from-bottom-2">
                  {attachedImages.map((img, i) => (
                    <div key={i} className="relative group/img">
                      <img src={img} className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                      <button type="button" onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`relative flex items-center bg-white border-2 border-slate-200 p-2 shadow-sm transition-all duration-300 ${attachedImages.length > 0 ? 'rounded-b-[28px] border-t-0' : 'rounded-[28px]'} group-focus-within:border-slate-900`}>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-slate-900 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*" />
                <input 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask a question or describe an image..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-3.5 px-4 font-semibold"
                />
                <button type="submit" disabled={!inputValue.trim() || status === AppStatus.LOADING} className={`p-4 rounded-full transition-all ${!inputValue.trim() || status === AppStatus.LOADING ? 'text-slate-200 bg-slate-50' : 'bg-slate-900 text-white shadow-xl hover:scale-105 active:scale-95'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </button>
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
