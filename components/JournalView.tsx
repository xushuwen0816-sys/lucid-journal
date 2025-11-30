
import React, { useState, useEffect } from 'react';
import { analyzeJournalEntry } from '../services/geminiService';
import { JournalEntry } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, SimpleMarkdown } from './Shared';
import { BookOpen, Send, Sparkles, RefreshCw } from 'lucide-react';

interface JournalViewProps {
    onAddJournalEntry: (entry: JournalEntry) => void;
}

const JournalView: React.FC<JournalViewProps> = ({ onAddJournalEntry }) => {
  const [loading, setLoading] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [journalAnalysis, setJournalAnalysis] = useState<JournalEntry['aiAnalysis'] | null>(null);

  // Persistence Key Helper
  const getTodayKey = () => new Date().toLocaleDateString('zh-CN');

  // Load from LocalStorage on mount
  useEffect(() => {
      const savedJournal = localStorage.getItem(`lucid_journal_${getTodayKey()}`);

       if (savedJournal) {
          try {
              const data = JSON.parse(savedJournal);
              // Only load if it looks like a draft (content exists)
              if (data.content) {
                setJournalInput(data.content || '');
                // We typically don't load the analysis from draft unless we want to restore state exactly.
                // But for "clear on return" logic, if we removed LS on submit, this won't trigger anyway.
                // If it exists, it means it's a draft.
                setJournalAnalysis(data.analysis || null);
              }
          } catch(e) { console.error(e) }
      }
  }, []);

  // Auto-save Draft
  // We ONLY save to localStorage if there is NO analysis present (meaning we are in drafting mode).
  // Once analyzed/submitted, we stop syncing to LS so that if the user leaves, the LS is empty/clean.
  useEffect(() => {
    if (!journalAnalysis) {
        localStorage.setItem(`lucid_journal_${getTodayKey()}`, JSON.stringify({
            content: journalInput,
            analysis: null
        }));
    }
  }, [journalInput, journalAnalysis]);

  const handleJournalSubmit = async () => {
    if (!journalInput) return;
    setLoading(true);
    const analysis = await analyzeJournalEntry(journalInput);
    if (analysis) {
        setJournalAnalysis(analysis);
        
        // Archive globally
        const newEntry: JournalEntry = {
            id: crypto.randomUUID(),
            date: Date.now(),
            content: journalInput,
            aiAnalysis: analysis
        };
        onAddJournalEntry(newEntry);
        
        // CRITICAL CHANGE: 
        // 1. Do NOT clear journalInput/journalAnalysis state here. Keep it visible for the user.
        // 2. DO clear LocalStorage. This ensures that when the user navigates away (unmount) 
        //    and comes back (remount), the `useEffect` above finds nothing, giving a clean slate.
        localStorage.removeItem(`lucid_journal_${getTodayKey()}`);
    }
    setLoading(false);
  };

  const handleStartNew = () => {
      setJournalInput('');
      setJournalAnalysis(null);
      localStorage.removeItem(`lucid_journal_${getTodayKey()}`);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <SectionTitle title="觉察日记" subtitle="JOURNAL · 内观" />

      <div className="flex-1 overflow-y-auto px-1 md:px-4 pb-20 no-scrollbar animate-fade-in relative">
        <div className="max-w-4xl mx-auto w-full pt-2">
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-10">
                
                {/* Writing Area */}
                <Card className="border-white/10 bg-gradient-to-b from-stone-800/20 to-transparent !p-0 overflow-hidden flex flex-col min-h-[60vh]">
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2 text-lucid-dim">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-xs font-serif tracking-widest">今日觉察 Writing Space</span>
                        </div>
                        <span className="text-[10px] text-stone-600 font-serif">{new Date().toLocaleDateString()}</span>
                    </div>
                    
                    <textarea
                        className="flex-1 w-full bg-transparent p-6 md:p-8 text-base md:text-lg font-serif focus:outline-none text-stone-200 placeholder-stone-700/50 resize-none transition-all leading-loose tracking-wide custom-scrollbar"
                        placeholder="在此刻的静谧中，写下你的情绪、念头或梦境..."
                        value={journalInput}
                        onChange={(e) => {
                            setJournalInput(e.target.value);
                            // If user starts typing again after analysis, we don't necessarily clear analysis immediately
                            // to allow them to correct typos. But if they want a new entry, they should use "Start New".
                        }}
                        autoFocus
                    />
                    
                    <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-end">
                        <Button onClick={handleJournalSubmit} disabled={loading || !journalInput.trim()} variant="glass" className="rounded-full px-6 py-2.5 text-sm hover:bg-white/10 transition-colors">
                            {loading ? <LoadingSpinner /> : <><Send className="w-4 h-4 mr-2" /> AI 深度觉察并存档</>}
                        </Button>
                    </div>
                </Card>

                {/* Analysis Result Display - Restored */}
                {journalAnalysis && (
                    <div className="space-y-4 animate-fade-in pt-4">
                        {/* Tags Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">情绪状态 Emotional State</span>
                                <div className="flex flex-wrap gap-2">
                                    {Array.isArray(journalAnalysis.emotionalState) && journalAnalysis.emotionalState.map((e, i) => (
                                        <span key={i} className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20 font-serif">
                                            {e}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">识别信念 Blocks & Beliefs</span>
                                <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.blocksIdentified?.map((b, i) => (
                                        <span key={i} className="text-xs bg-rose-500/10 text-rose-300 px-2 py-1 rounded border border-rose-500/20">
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">高我特质 High Self Traits</span>
                                <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.highSelfTraits?.map((t, i) => (
                                        <span key={i} className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded border border-indigo-500/20">
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Insight Card */}
                        <Card className="bg-lucid-glow/5 border-lucid-glow/10 p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Sparkles className="w-16 h-16" />
                            </div>
                            <h4 className="text-sm font-serif text-lucid-glow mb-3 uppercase tracking-widest">LUCID 深度洞见</h4>
                            <div className="text-stone-300 font-serif text-base leading-loose whitespace-pre-wrap">
                                <SimpleMarkdown content={journalAnalysis.summary} />
                            </div>
                        </Card>

                        {/* Advice Card */}
                        <Card className="bg-emerald-900/10 border-emerald-500/10 p-6">
                             <h4 className="text-sm font-serif text-emerald-300 mb-3 uppercase tracking-widest">明日指引 Guidance</h4>
                             <div className="text-stone-300 font-serif text-base leading-loose whitespace-pre-wrap">
                                 <SimpleMarkdown content={journalAnalysis.tomorrowsAdvice} />
                             </div>
                        </Card>

                        {/* Action Buttons */}
                        <div className="flex justify-center pt-6 pb-6">
                             <Button onClick={handleStartNew} variant="ghost" className="text-stone-500 hover:text-white text-xs border border-white/5 hover:bg-white/5 rounded-full px-6">
                                 <RefreshCw className="w-4 h-4 mr-2" /> 开启新的一页 (Start New)
                             </Button>
                        </div>
                    </div>
                )}
                
                {!journalAnalysis && (
                    <div className="text-center text-stone-500 text-xs py-4">
                        <p className="flex items-center justify-center gap-2 opacity-50"><Sparkles className="w-3 h-3"/> 每次提交都会自动保存到日历中，不用担心覆盖。</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default JournalView;