
import React, { useState, useEffect, useRef } from 'react';
import { analyzeJournalEntry, embedText } from '../services/geminiService';
import { JournalEntry, FutureLetter } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, SimpleMarkdown } from './Shared';
import { BookOpen, Send, Sparkles, RefreshCw, AlertCircle, Smile, Mail, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface JournalViewProps {
    onAddJournalEntry: (entry: JournalEntry) => void;
    onAddLetter: (letter: FutureLetter) => void;
}

// Helper to safely render text that might be an object
const safeRender = (val: any): string => {
    if (!val) return "";
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        return val.text || val.content || val.description || val.meaning || val.name || JSON.stringify(val);
    }
    return String(val);
};

const JournalView: React.FC<JournalViewProps> = ({ onAddJournalEntry, onAddLetter }) => {
  // Journal State
  const [loading, setLoading] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [journalAnalysis, setJournalAnalysis] = useState<JournalEntry['aiAnalysis'] | null>(null);

  // Letter State
  const [mode, setMode] = useState<'journal' | 'letter'>('journal');
  const [letterInput, setLetterInput] = useState('');
  const [letterDelay, setLetterDelay] = useState<number>(30); // days
  const [isSendingLetter, setIsSendingLetter] = useState(false);
  const { token } = useAuth();
  
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only apply effect if inputs are empty (to avoid distraction while typing)
    const hasContent = mode === 'journal' ? !!journalInput : !!letterInput;
    
    if (cardRef.current && !hasContent) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate rotation (Tilted Card Effect)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      // Max rotation in degrees
      const maxRotation = 2;
      
      const rotateY = ((x - centerX) / centerX) * maxRotation;
      const rotateX = -((y - centerY) / centerY) * maxRotation;

      cardRef.current.style.setProperty('--mouse-x', `${x}px`);
      cardRef.current.style.setProperty('--mouse-y', `${y}px`);
      cardRef.current.style.setProperty('--rotate-x', `${rotateX}deg`);
      cardRef.current.style.setProperty('--rotate-y', `${rotateY}deg`);
    }
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
        cardRef.current.style.setProperty('--rotate-x', '0deg');
        cardRef.current.style.setProperty('--rotate-y', '0deg');
    }
  };

  // Persistence Key Helper
    const getTodayKey = () => new Date().toLocaleDateString('zh-CN');

    const { isLightMode } = useTheme();

    // Load from LocalStorage on mount
    useEffect(() => {
      const savedJournal = localStorage.getItem(`lucid_journal_${getTodayKey()}`);
      if (savedJournal) {
          try {
              const data = JSON.parse(savedJournal);
              // If analysis exists, it means the previous entry was completed/submitted.
              // Requirement: Clear writing space if returning after successful analysis.
              if (data.analysis) {
                  setJournalInput('');
                  setJournalAnalysis(null);
                  // Clear the scratchpad so we don't reload the finished entry as a draft
                  localStorage.removeItem(`lucid_journal_${getTodayKey()}`);
              } else {
                  // Draft mode - Restore content
                  setJournalInput(data.content || '');
                  setJournalAnalysis(null);
              }
          } catch(e) { console.error(e) }
      }
  }, []);

  // Auto-save draft
  useEffect(() => {
      // If both are empty, clear the storage to avoid restoring stale data
      if (!journalInput && !journalAnalysis) {
          localStorage.removeItem(`lucid_journal_${getTodayKey()}`);
          return;
      }
      
      const data = {
          content: journalInput,
          analysis: journalAnalysis
      };
      localStorage.setItem(`lucid_journal_${getTodayKey()}`, JSON.stringify(data));
  }, [journalInput, journalAnalysis]);

  const handleJournalSubmit = async () => {
    if (!journalInput) return;
    setLoading(true);
    // AI 分析与语义向量化并行请求，不增加整体等待时间
    const [analysis, embedding] = await Promise.all([
      analyzeJournalEntry(journalInput),
      embedText(journalInput),
    ]);
    if (analysis) {
        setJournalAnalysis(analysis);
        
        // Save (this triggers the effect, but we ensure it's saved immediately too)
        const data = {
            content: journalInput,
            analysis: analysis
        };
        localStorage.setItem(`lucid_journal_${getTodayKey()}`, JSON.stringify(data));

        // Archive globally
        const newEntry: JournalEntry = {
            id: crypto.randomUUID(),
            date: Date.now(),
            content: journalInput,
            aiAnalysis: analysis,
            embedding: embedding || undefined
        };
        onAddJournalEntry(newEntry);
    }
    setLoading(false);
  };

  const handleSendLetter = async () => {
    if(!letterInput.trim()) return;
    setIsSendingLetter(true);
    
    // Calculate unlock time
    const unlockTime = Date.now() + (letterDelay * 24 * 60 * 60 * 1000); 
    // Give AI some time (e.g. 2 minutes) if sending immediately, to avoid sending email before AI reply is synced
    // NOTE: AI reply is currently disabled, so we can just use a short buffer or even 0.
    const actualUnlockTime = letterDelay === 0 ? Date.now() + 10000 : unlockTime;

    // Generate ID upfront
    const newLetterId = crypto.randomUUID();

    // 1. Initial Save (Optimistic & Data Safety)
    const initialLetterData = {
        id: newLetterId,
        content: letterInput,
        sendDate: actualUnlockTime,
        aiReply: null, // AI disabled
        isLocked: true
    };

    let savedToServer = false;
    let savedLetterResult: FutureLetter | null = null;

    try {
        if (token) {
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const targetUrl = `${baseUrl}/api/letters`;
            console.log('Step 1: Saving letter content to:', targetUrl);

            // Add timeout for the initial save (10s)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(initialLetterData),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                savedToServer = true;
                savedLetterResult = await res.json();
                if (savedLetterResult) {
                     onAddLetter({
                        ...savedLetterResult,
                        createdAt: new Date(savedLetterResult.createdAt).getTime(),
                        sendDate: new Date(savedLetterResult.sendDate).getTime()
                    });
                }
            } else {
                 console.warn(`Server error during initial save: ${res.status}`);
                 throw new Error(`Server error: ${res.status}`);
            }
        } else {
             // No token - Offline mode
             throw new Error("No token");
        }
    } catch (e) {
        console.warn("Failed to save initial letter (Step 1), falling back to offline:", e);
        // Fallback to offline immediately if Step 1 fails
         const newLetter: FutureLetter = {
              id: newLetterId,
              createdAt: Date.now(),
              content: letterInput,
              sendDate: actualUnlockTime,
              aiReply: null, // AI disabled
              isLocked: true
            };
            onAddLetter(newLetter);
            setLetterInput('');
            setIsSendingLetter(false);
            alert('信件已保存（离线模式）。'); 
            return; 
    }

    // SUCCESS: Notify User & Reset UI IMMEDIATELY
    setIsSendingLetter(false);
    setLetterInput('');
    alert('信件已寄出！');
  };

  return (
    <div className="w-full h-full flex flex-col">
        <SectionTitle title="觉察日记" subtitle="JOURNAL · 内在对话" />

        <div className="flex-1 overflow-y-auto px-4 pb-20 no-scrollbar animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-6 pt-6">
                <Card 
                    ref={cardRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        '--mouse-x': '0px',
                        '--mouse-y': '0px',
                        '--rotate-x': '0deg',
                        '--rotate-y': '0deg',
                        transform: (mode === 'journal' ? journalInput : letterInput) ? 'none' : 'perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y))',
                        willChange: 'transform',
                    } as React.CSSProperties}
                    className={`border-white/10 bg-gradient-to-b !p-0 overflow-hidden relative group transition-all duration-200 ease-out ${
                        (mode === 'journal' ? !journalInput : !letterInput) ? 'hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.05)]' : ''
                    } ${isLightMode ? 'from-white/40 to-white/10 border-stone-200 shadow-xl' : 'from-stone-800/20 to-transparent'}`}
                >
                    {/* Card Header with Toggle */}
                    <div className={`flex items-center justify-between px-4 md:px-6 h-16 border-b ${isLightMode ? 'bg-white/60 border-stone-200 text-stone-600' : 'bg-white/[0.02] border-white/5 text-lucid-dim'}`}>
                        <div className="flex items-center gap-2">
                            {mode === 'journal' ? <BookOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                            <span className="text-xs font-serif tracking-widest">
                                {mode === 'journal' ? '今日觉察 Writing Space' : '致未来的信 Time Capsule'}
                            </span>
                        </div>
                        <Button 
                            onClick={() => setMode(mode === 'journal' ? 'letter' : 'journal')}
                            variant="ghost" 
                            className={`text-xs px-3 py-1 h-8 rounded-full border transition-colors ${isLightMode ? 'hover:bg-orange-100/50 border-stone-300 text-stone-500 hover:text-stone-800' : 'hover:bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'}`}
                        >
                            {mode === 'journal' ? '写信给未来' : '返回日记'}
                        </Button>
                    </div>

                    {/* Content Area */}
                    {mode === 'journal' ? (
                        <textarea
                            className={`w-full p-6 md:p-8 text-lg font-serif focus:outline-none min-h-[50vh] resize-none transition-all leading-loose tracking-wide ${isLightMode ? 'bg-white/40 text-stone-800 placeholder-stone-400/70' : 'bg-black/20 text-stone-200 placeholder-stone-700/50'}`}
                            placeholder="在此处深呼吸，记录当下的情绪、念头、梦境，或是任何浮现的直觉..."
                            value={journalInput}
                            onChange={(e) => setJournalInput(e.target.value)}
                        />
                    ) : (
                        <textarea
                            className={`w-full p-6 md:p-8 text-lg font-serif focus:outline-none min-h-[50vh] resize-none transition-all leading-loose tracking-wide ${isLightMode ? 'bg-white/40 text-stone-800 placeholder-stone-400/70' : 'bg-black/20 text-stone-200 placeholder-stone-700/50'}`}
                            placeholder={`这封信将被封存，直到设定的时间开启...`}
                            value={letterInput}
                            onChange={(e) => setLetterInput(e.target.value)}
                        />
                    )}

                    {/* Footer / Actions */}
                    <div className={`px-4 md:px-6 h-16 border-t flex items-center justify-end ${isLightMode ? 'bg-white/60 border-stone-200' : 'bg-white/[0.02] border-white/5'}`}>
                        {mode === 'journal' ? (
                            <Button onClick={handleJournalSubmit} disabled={loading || !journalInput.trim()} variant="glass" className={`rounded-full px-6 py-2 text-sm shadow-lg ${isLightMode ? 'border-orange-200 hover:bg-orange-100/50 text-orange-600 shadow-orange-100' : 'border-lucid-glow/20 hover:bg-lucid-glow/10 text-lucid-glow shadow-lucid-glow/5'}`}>
                                {loading ? <LoadingSpinner /> : <><Sparkles className="w-4 h-4 mr-2" /> AI 深度觉察</>}
                            </Button>
                        ) : (
                            <div className="flex items-center justify-between w-full">
                                <div className={`flex items-center gap-2 text-xs ${isLightMode ? 'text-stone-500' : 'text-stone-500'}`}>
                                    <Clock className="w-3 h-3" />
                                    <span>寄送时间:</span>
                                    <select 
                                        value={letterDelay} 
                                        onChange={(e) => setLetterDelay(Number(e.target.value))}
                                        className={`border rounded px-2 py-1 focus:outline-none ${isLightMode ? 'bg-white/60 border-stone-200 text-stone-700' : 'bg-black/20 border-white/10 text-stone-300'}`}
                                    >
                                        <option value={0}>10秒后 (测试)</option>
                                        <option value={7}>7天后</option>
                                        <option value={30}>30天后</option>
                                        <option value={90}>3个月后</option>
                                        <option value={180}>6个月后</option>
                                        <option value={365}>1年后</option>
                                        <option value={1095}>3年后</option>
                                        <option value={1825}>5年后</option>
                                        <option value={3650}>10年后</option>
                                    </select>
                                </div>
                                <Button onClick={handleSendLetter} disabled={isSendingLetter || !letterInput.trim()} variant="glass" className={`rounded-full px-6 py-2 text-sm shadow-lg ${isLightMode ? 'border-orange-200 hover:bg-orange-100/50 text-orange-600 shadow-orange-100' : 'border-lucid-glow/20 hover:bg-lucid-glow/10 text-lucid-glow shadow-lucid-glow/5'}`}>
                                    {isSendingLetter ? <LoadingSpinner /> : <><Send className="w-4 h-4 mr-2" /> 封存信件</>}
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {journalAnalysis && mode === 'journal' && (
                    <div className="space-y-6 animate-fade-in pb-10">
                        {/* 3-Column Grid for Core Analysis Stats - All Parallel */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* 1. Emotional State (Yellow) */}
                            <div className={`rounded-2xl p-5 border transition-colors h-full ${isLightMode ? 'bg-white/60 border-stone-200 hover:bg-white/80' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                <span className="text-xs uppercase text-stone-500 tracking-wider mb-3 font-bold flex items-center gap-2">
                                    <Smile className="w-3 h-3" /> 情绪状态 Emotion
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {Array.isArray(journalAnalysis.emotionalState) ? (
                                        journalAnalysis.emotionalState.map((emotion, i) => (
                                            <span key={i} className={`inline-block px-3 py-1 rounded-full text-sm border font-serif ${isLightMode ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20'}`}>
                                                {safeRender(emotion)}
                                            </span>
                                        ))
                                    ) : (
                                        <span className={`inline-block px-3 py-1 rounded-full text-sm border font-serif ${isLightMode ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20'}`}>
                                            {safeRender(journalAnalysis.emotionalState)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 2. Identified Blocks (Red) */}
                            <div className={`rounded-2xl p-5 border transition-colors h-full ${isLightMode ? 'bg-white/60 border-stone-200 hover:bg-white/80' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                <span className="text-xs uppercase text-stone-500 tracking-wider mb-3 font-bold flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3" /> 识别信念 Beliefs
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.blocksIdentified?.map((b, i) => (
                                        <span key={i} className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full border font-serif ${isLightMode ? 'bg-red-100 text-red-700 border-red-200' : 'bg-red-500/10 text-red-300 border-red-500/20'}`}>
                                            {safeRender(b)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 3. High Self Traits (Indigo) */}
                            <div className={`rounded-2xl p-5 border transition-colors h-full ${isLightMode ? 'bg-white/60 border-stone-200 hover:bg-white/80' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                 <span className="text-xs uppercase text-stone-500 tracking-wider mb-3 font-bold flex items-center gap-2">
                                     <Sparkles className="w-3 h-3" /> 高我特质 Traits
                                 </span>
                                 <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.highSelfTraits && journalAnalysis.highSelfTraits.length > 0 ? (
                                        journalAnalysis.highSelfTraits.map((t, i) => (
                                            <span key={i} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-serif ${isLightMode ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'}`}>
                                            {safeRender(t)}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-stone-600/50 text-xs italic">能量整合中...</span>
                                    )}
                                 </div>
                            </div>
                        </div>
                        
                        {/* Summary */}
                        <Card className={`p-6 relative overflow-hidden ${isLightMode ? 'bg-orange-50 border-orange-100' : 'bg-lucid-glow/5 border-lucid-glow/10'}`}>
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Sparkles className="w-16 h-16" />
                            </div>
                            <h4 className={`text-sm font-serif mb-4 flex items-center gap-2 uppercase tracking-widest border-b pb-2 inline-block ${isLightMode ? 'text-orange-600 border-orange-200' : 'text-lucid-glow border-lucid-glow/10'}`}>
                                <Sparkles className="w-4 h-4" /> LUCID 洞见
                            </h4>
                            <div className={`font-serif text-lg leading-loose whitespace-pre-wrap ${isLightMode ? 'text-stone-700' : 'text-stone-300'}`}>
                                <SimpleMarkdown content={safeRender(journalAnalysis.summary)} />
                            </div>
                        </Card>

                        {/* Advice */}
                        <Card className={`p-6 ${isLightMode ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-900/10 border-emerald-500/10'}`}>
                            <h4 className={`text-sm font-serif mb-4 uppercase tracking-widest border-b pb-2 w-full block ${isLightMode ? 'text-emerald-700 border-emerald-200' : 'text-emerald-300 border-emerald-500/10'}`}>
                                明日建议 GUIDANCE
                            </h4>
                            <div className={`font-serif text-lg leading-loose whitespace-pre-wrap ${isLightMode ? 'text-stone-700' : 'text-stone-300'}`}>
                                <SimpleMarkdown content={safeRender(journalAnalysis.tomorrowsAdvice)} />
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default JournalView;
