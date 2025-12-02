
import React, { useState, useEffect } from 'react';
import { analyzeJournalEntry } from '../services/geminiService';
import { JournalEntry } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, SimpleMarkdown } from './Shared';
import { BookOpen, Send, Sparkles, RefreshCw } from 'lucide-react';

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
        <SectionTitle title="觉察日记" subtitle="JOURNAL · 内在对话" />

        <div className="flex-1 overflow-y-auto px-4 pb-20 custom-scrollbar animate-fade-in">
            <div className="max-w-2xl mx-auto space-y-6 pt-6">
                <Card className="border-white/10 bg-gradient-to-b from-stone-800/20 to-transparent !p-4 md:!p-6">
                    <div className="flex items-center gap-2 mb-3 text-lucid-dim">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-xs font-serif tracking-widest">今日觉察 Writing Space</span>
                    </div>
                    <textarea
                        className="w-full bg-black/20 rounded-xl p-4 text-base font-serif focus:outline-none min-h-[200px] text-stone-200 placeholder-stone-700 resize-none border border-white/5 focus:border-lucid-glow/20 transition-all leading-relaxed"
                        placeholder="记录当下的情绪、念头、梦境，或是任何浮现的直觉..."
                        value={journalInput}
                        onChange={(e) => setJournalInput(e.target.value)}
                    />
                    <div className="flex justify-end mt-3">
                        <Button onClick={handleJournalSubmit} disabled={loading || !journalInput.trim()} variant="glass" className="rounded-full px-6 py-2 text-sm border-lucid-glow/20 hover:bg-lucid-glow/10 text-lucid-glow">
                            {loading ? <LoadingSpinner /> : <><Sparkles className="w-4 h-4 mr-2" /> AI 深度觉察</>}
                        </Button>
                    </div>
                </Card>

                {journalAnalysis && (
                    <div className="space-y-6 animate-fade-in pb-10">
                        <div className="flex gap-4">
                            <div className="flex-1 bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">情绪状态</span>
                                <div className="flex flex-wrap gap-2">
                                    {Array.isArray(journalAnalysis.emotionalState) ? (
                                        journalAnalysis.emotionalState.map((emotion, i) => (
                                            <span key={i} className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-sm border border-indigo-500/20 font-serif">
                                                {safeRender(emotion)}
                                            </span>
                                        ))
                                    ) : (
                                        // Legacy support for string
                                        <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-sm border border-indigo-500/20 font-serif">
                                            {safeRender(journalAnalysis.emotionalState)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-xs uppercase text-stone-500 tracking-wider block mb-2">识别信念</span>
                                <div className="flex flex-wrap gap-2">
                                    {journalAnalysis.blocksIdentified?.map((b, i) => (
                                        <span key={i} className="text-xs bg-rose-500/10 text-rose-300 px-2 py-1 rounded">{safeRender(b)}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        <Card className="bg-lucid-glow/5 border-lucid-glow/10 p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Sparkles className="w-16 h-16" />
                            </div>
                            <h4 className="text-sm font-serif text-lucid-glow mb-3 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> LUCID 洞见
                            </h4>
                            <div className="text-stone-300 font-serif text-base leading-loose">
                                <SimpleMarkdown content={safeRender(journalAnalysis.summary)} />
                            </div>
                        </Card>

                        <Card className="bg-emerald-900/10 border-emerald-500/10 p-6">
                                <h4 className="text-sm font-serif text-emerald-300 mb-3">明日建议</h4>
                                <div className="text-stone-300 font-serif text-base leading-loose">
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
