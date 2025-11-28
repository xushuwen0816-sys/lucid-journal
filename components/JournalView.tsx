

import React, { useState, useEffect } from 'react';
import { analyzeJournalEntry } from '../services/geminiService';
import { JournalEntry } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, SimpleMarkdown } from './Shared';
import { BookOpen, Send } from 'lucide-react';

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
              setJournalInput(data.content || '');
              setJournalAnalysis(data.analysis || null);
          } catch(e) { console.error(e) }
      }
  }, []);

  const handleJournalSubmit = async () => {
    if (!journalInput) return;
    setLoading(true);
    const analysis = await analyzeJournalEntry(journalInput);
    if (analysis) {
        setJournalAnalysis(analysis);
        
        // Save for current session/today view
        localStorage.setItem(`lucid_journal_${getTodayKey()}`, JSON.stringify({
            content: journalInput,
            analysis: analysis
        }));

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
      <SectionTitle title="觉察日记" subtitle="JOURNAL · 内观" />

      <div className="flex-1 overflow-y-auto px-1 md:px-4 pb-20 no-scrollbar animate-fade-in relative">
        <div className="max-w-4xl mx-auto w-full pt-2">
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-10">
                
                {/* Writing Area - Expanded */}
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
                        onChange={(e) => setJournalInput(e.target.value)}
                        autoFocus
                    />
                    
                    <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-end">
                        <Button onClick={handleJournalSubmit} disabled={loading || !journalInput.trim()} variant="glass" className="rounded-full px-6 py-2.5 text-sm hover:bg-white/10 transition-colors">
                            {loading ? <LoadingSpinner /> : <><Send className="w-4 h-4 mr-2" /> AI 深度觉察</>}
                        </Button>
                    </div>
                </Card>

                {journalAnalysis && (
                    <div className="space-y-4 animate-fade-in pt-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">情绪状态</span>
                                <div className="flex flex-wrap gap-2">
                                    {Array.isArray(journalAnalysis.emotionalState) ? (
                                        journalAnalysis.emotionalState.map((emotion, i) => (
                                            <span key={i} className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-sm border border-indigo-500/20 font-serif">
                                                {emotion}
                                            </span>
                                        ))
                                    ) : (
                                        // Legacy support for string
                                        <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-sm border border-indigo-500/20 font-serif">
                                            {journalAnalysis.emotionalState}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">识别信念</span>
                                <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.blocksIdentified?.map((b, i) => (
                                        <span key={i} className="text-xs bg-rose-500/10 text-rose-300 px-2 py-1 rounded">{b}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <Card className="bg-lucid-glow/5 border-lucid-glow/10 p-6 md:p-8">
                            <h4 className="text-sm font-serif text-lucid-glow mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-lucid-glow"></span>
                                LUCID 洞见
                            </h4>
                            <div className="text-stone-300 font-serif text-base md:text-lg leading-loose text-justify">
                                <SimpleMarkdown content={journalAnalysis.summary} />
                            </div>
                        </Card>

                        <Card className="bg-emerald-900/10 border-emerald-500/10 p-6 md:p-8">
                                <h4 className="text-sm font-serif text-emerald-300 mb-4 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    明日建议
                                </h4>
                                <div className="text-stone-300 font-serif text-base md:text-lg leading-loose text-justify">
                                    <SimpleMarkdown content={journalAnalysis.tomorrowsAdvice} />
                                </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default JournalView;
