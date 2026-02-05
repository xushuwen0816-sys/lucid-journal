
import React, { useState, useEffect, useRef } from 'react';
import { analyzeJournalEntry } from '../services/geminiService';
import { JournalEntry } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, SimpleMarkdown } from './Shared';
import { BookOpen, Send, Sparkles, RefreshCw, AlertCircle, Smile } from 'lucide-react';

interface JournalViewProps {
    onAddJournalEntry: (entry: JournalEntry) => void;
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

const JournalView: React.FC<JournalViewProps> = ({ onAddJournalEntry }) => {
  const [loading, setLoading] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [journalAnalysis, setJournalAnalysis] = useState<JournalEntry['aiAnalysis'] | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current && !journalInput) {
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
    const analysis = await analyzeJournalEntry(journalInput);
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
            aiAnalysis: analysis
        };
        onAddJournalEntry(newEntry);
    }
    setLoading(false);
  };

  return (
    <div className="w-full h-full flex flex-col">
        <SectionTitle title="觉察日记" subtitle="JOURNAL · 内在对话" />

        <div className="flex-1 overflow-y-auto px-4 pb-20 custom-scrollbar animate-fade-in">
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
                        transform: journalInput ? 'none' : 'perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y))',
                        willChange: 'transform',
                    } as React.CSSProperties}
                    className={`border-white/10 bg-gradient-to-b from-stone-800/20 to-transparent !p-0 overflow-hidden relative group transition-all duration-200 ease-out ${
                        !journalInput ? 'hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.05)]' : ''
                    }`}
                >
                    <div className="flex items-center gap-2 px-4 md:px-6 h-16 border-b border-white/5 bg-white/[0.02] text-lucid-dim">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-xs font-serif tracking-widest">今日觉察 Writing Space</span>
                    </div>
                    <textarea
                        className="w-full bg-black/20 p-6 md:p-8 text-lg font-serif focus:outline-none min-h-[50vh] text-stone-200 placeholder-stone-700/50 resize-none transition-all leading-loose tracking-wide"
                        placeholder="在此处深呼吸，记录当下的情绪、念头、梦境，或是任何浮现的直觉..."
                        value={journalInput}
                        onChange={(e) => setJournalInput(e.target.value)}
                    />
                    <div className="px-4 md:px-6 h-16 border-t border-white/5 bg-white/[0.02] flex items-center justify-end">
                        <Button onClick={handleJournalSubmit} disabled={loading || !journalInput.trim()} variant="glass" className="rounded-full px-6 py-2 text-sm border-lucid-glow/20 hover:bg-lucid-glow/10 text-lucid-glow shadow-lg shadow-lucid-glow/5">
                            {loading ? <LoadingSpinner /> : <><Sparkles className="w-4 h-4 mr-2" /> AI 深度觉察</>}
                        </Button>
                    </div>
                </Card>

                {journalAnalysis && (
                    <div className="space-y-6 animate-fade-in pb-10">
                        {/* 3-Column Grid for Core Analysis Stats - All Parallel */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* 1. Emotional State (Yellow) */}
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-colors h-full">
                                <span className="text-xs uppercase text-stone-500 tracking-wider mb-3 font-bold flex items-center gap-2">
                                    <Smile className="w-3 h-3" /> 情绪状态 Emotion
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {Array.isArray(journalAnalysis.emotionalState) ? (
                                        journalAnalysis.emotionalState.map((emotion, i) => (
                                            <span key={i} className="inline-block px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-200 text-sm border border-yellow-500/20 font-serif">
                                                {safeRender(emotion)}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="inline-block px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-200 text-sm border border-yellow-500/20 font-serif">
                                            {safeRender(journalAnalysis.emotionalState)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 2. Identified Blocks (Red) */}
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-colors h-full">
                                <span className="text-xs uppercase text-stone-500 tracking-wider mb-3 font-bold flex items-center gap-2">
                                    <AlertCircle className="w-3 h-3" /> 识别信念 Beliefs
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.blocksIdentified?.map((b, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 text-sm bg-red-500/10 text-red-300 px-3 py-1 rounded-full border border-red-500/20 font-serif">
                                            {safeRender(b)}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 3. High Self Traits (Indigo) */}
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white/10 transition-colors h-full">
                                 <span className="text-xs uppercase text-stone-500 tracking-wider mb-3 font-bold flex items-center gap-2">
                                     <Sparkles className="w-3 h-3" /> 高我特质 Traits
                                 </span>
                                 <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.highSelfTraits && journalAnalysis.highSelfTraits.length > 0 ? (
                                        journalAnalysis.highSelfTraits.map((t, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300 font-serif">
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
                        <Card className="bg-lucid-glow/5 border-lucid-glow/10 p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Sparkles className="w-16 h-16" />
                            </div>
                            <h4 className="text-sm font-serif text-lucid-glow mb-4 flex items-center gap-2 uppercase tracking-widest border-b border-lucid-glow/10 pb-2 inline-block">
                                <Sparkles className="w-4 h-4" /> LUCID 洞见
                            </h4>
                            <div className="text-stone-300 font-serif text-lg leading-loose whitespace-pre-wrap">
                                <SimpleMarkdown content={safeRender(journalAnalysis.summary)} />
                            </div>
                        </Card>

                        {/* Advice */}
                        <Card className="bg-emerald-900/10 border-emerald-500/10 p-6">
                            <h4 className="text-sm font-serif text-emerald-300 mb-4 uppercase tracking-widest border-b border-emerald-500/10 pb-2 w-full block">
                                明日建议 GUIDANCE
                            </h4>
                            <div className="text-stone-300 font-serif text-lg leading-loose whitespace-pre-wrap">
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
