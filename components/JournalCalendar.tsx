import React, { useState, useMemo, useEffect } from 'react';
import { JournalEntry, RitualArchiveEntry } from '../types';
import { SimpleMarkdown } from './Shared';
import { ChevronLeft, CreditCard, Sun, Calendar as CalendarIcon, Check, X, Trash2, Sparkles, AlertCircle } from 'lucide-react';

interface JournalCalendarProps {
    initialDate?: Date | null;
    journalEntries: JournalEntry[];
    ritualEntries: RitualArchiveEntry[];
    onDeleteJournalEntry?: (id: string) => void;
}

// Helper: Get Heatmap Color Class based on emotions (Duplicated for now, ideally in utils)
const getMoodStyle = (emotions: string[] = []): string => {
    if (!emotions || emotions.length === 0) return 'bg-white/[0.05] border-white/10 text-stone-400';

    const e = emotions.join(' ').toLowerCase();
    
    if (e.match(/joy|happy|excited|confident|proud|喜悦|快乐|兴奋|自信|自豪|inspired|灵感/)) {
        return 'bg-orange-500/30 border-orange-500/40 text-orange-100 shadow-[0_0_10px_rgba(249,115,22,0.2)]';
    }
    if (e.match(/love|grateful|hope|爱|感恩|希望|touch|感动/)) {
        return 'bg-rose-500/30 border-rose-500/40 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
    }
    if (e.match(/peace|calm|content|relieved|平静|安宁|满足|释然|safe|安全/)) {
        return 'bg-emerald-500/30 border-emerald-500/40 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
    }
    if (e.match(/sad|lonely|tired|bored|hopeless|悲伤|孤独|疲惫|无聊|绝望|depress/)) {
        return 'bg-indigo-500/30 border-indigo-500/40 text-indigo-200';
    }
    if (e.match(/angry|frustrated|anxious|fear|guilty|愤怒|挫败|焦虑|恐惧|内疚|压力/)) {
        return 'bg-stone-700/80 border-rose-500/30 text-rose-200';
    }

    return 'bg-stone-700 border-white/20 text-stone-200';
};

const JournalCalendar: React.FC<JournalCalendarProps> = ({ initialDate, journalEntries, ritualEntries, onDeleteJournalEntry }) => {
    const [selectedEntry, setSelectedEntry] = useState<{ journals: JournalEntry[], ritual?: RitualArchiveEntry, dateStr: string } | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Map entries to days string key "YYYY-MM-DD"
    const entriesByDay = useMemo(() => {
        const map: Record<string, { journals: JournalEntry[], ritual?: RitualArchiveEntry }> = {};
        
        journalEntries.forEach(e => {
            const d = new Date(e.date).toDateString();
            if (!map[d]) {
                map[d] = { journals: [], ritual: undefined };
            }
            map[d].journals.push(e);
        });
        
        // Ensure journals are sorted (newest first)
        Object.keys(map).forEach(key => {
            map[key].journals.sort((a,b) => b.date - a.date);
        });

        ritualEntries.forEach(r => {
            const d = new Date(r.date).toDateString();
            if (!map[d]) {
                map[d] = { journals: [], ritual: undefined };
            }
            map[d] = { ...map[d], ritual: r };
        });
        return map;
    }, [journalEntries, ritualEntries]);

    // Initialize selected entry from prop if provided
    useEffect(() => {
        if (initialDate) {
            const dateStr = initialDate.toDateString();
            const entry = entriesByDay[dateStr];
            if (entry && (entry.journals.length > 0 || entry.ritual)) {
                setSelectedEntry({
                    journals: entry.journals,
                    ritual: entry.ritual,
                    dateStr: initialDate.toLocaleDateString()
                });
            }
        }
    }, [initialDate, entriesByDay]);

    // Determine range of months to display
    const monthsToDisplay = useMemo(() => {
        const now = new Date();
        const dates = journalEntries.map(e => e.date).concat(ritualEntries.map(e => e.date));
        const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
        
        const result: Date[] = [];
        const current = new Date(now.getFullYear(), now.getMonth(), 1);
        
        while (current >= new Date(minDate.getFullYear(), minDate.getMonth(), 1)) {
            result.push(new Date(current));
            current.setMonth(current.getMonth() - 1);
        }
        if (result.length === 0) result.push(new Date());
        
        return result;
    }, [journalEntries, ritualEntries]);

    return (
        <div className="flex flex-col h-full">
            {selectedEntry ? (
                <div className="animate-fade-in space-y-6">
                    <button onClick={() => setSelectedEntry(null)} className="flex items-center text-xs text-lucid-dim hover:text-white mb-2">
                        <ChevronLeft className="w-4 h-4 mr-1"/> 返回日历
                    </button>
                    
                    <div className="flex items-center justify-between">
                        <span className="text-xl text-white font-serif tracking-wide">
                            {selectedEntry.dateStr}
                        </span>
                    </div>

                    {/* Ritual Section */}
                    {selectedEntry.ritual && (
                        <div className="space-y-4">
                            {selectedEntry.ritual.reading && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-lucid-glow text-xs uppercase tracking-widest font-bold">
                                        <CreditCard className="w-3 h-3" /> Tarot Reading
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {selectedEntry.ritual.reading.cards.map((card, i) => (
                                            <div key={i} className={`p-2 bg-white/5 rounded-lg border border-white/10 text-center ${card.isReversed ? 'border-rose-500/20' : 'border-emerald-500/20'}`}>
                                                <span className="text-[10px] text-stone-500 block uppercase">{card.position}</span>
                                                <div className="text-sm font-serif text-white my-1">{card.name}</div>
                                                <span className="text-[9px] block text-stone-500">{card.isReversed ? 'Reversed' : 'Upright'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                        <p className="text-xs text-stone-300 font-serif leading-relaxed">
                                            {selectedEntry.ritual.reading.guidance}
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {selectedEntry.ritual.practice && (
                                <div className="space-y-2">
                                     <div className="flex items-center gap-2 text-emerald-400 text-xs uppercase tracking-widest font-bold">
                                        <Sun className="w-3 h-3" /> Daily Practice
                                    </div>
                                    <div className="bg-gradient-to-br from-emerald-900/10 to-transparent p-3 rounded-lg border border-emerald-500/10">
                                        <div className="text-xs text-emerald-200 mb-1">Affirmation:</div>
                                        <div className="text-sm text-white font-serif italic mb-3">"{selectedEntry.ritual.practice.todaysAffirmation}"</div>
                                        <div className="text-xs text-emerald-200 mb-1">Action:</div>
                                        <div className="text-xs text-stone-300">{selectedEntry.ritual.practice.actionStep}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Journals Section */}
                    {selectedEntry.journals.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2 text-stone-400 text-xs uppercase tracking-widest font-bold">
                                <CalendarIcon className="w-3 h-3" /> Journal Entries ({selectedEntry.journals.length})
                            </div>
                            
                            <div className="relative pl-2 space-y-6">
                                {/* Vertical Line */}
                                <div className="absolute top-2 bottom-2 left-[11px] w-[1px] bg-white/10"></div>
                                
                                {selectedEntry.journals.map((journal, idx) => (
                                    <div key={journal.id} className="relative pl-6">
                                        {/* Timeline dot */}
                                        <div className="absolute left-[7px] top-1.5 w-2.5 h-2.5 rounded-full bg-stone-600 border border-stone-900 z-10"></div>
                                        
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs text-stone-500 font-sans tracking-wide">
                                                {new Date(journal.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <div className="flex gap-1 flex-wrap justify-end items-center">
                                                {/* DELETE BUTTON WITH CONFIRMATION */}
                                                {onDeleteJournalEntry && (
                                                    <div className="relative z-20 flex items-center">
                                                        {confirmDeleteId === journal.id ? (
                                                            <div className="flex items-center gap-1 bg-stone-800 rounded-full px-1 py-0.5 border border-rose-500/30 animate-fade-in">
                                                                <span className="text-[9px] text-rose-300 pl-1">删除?</span>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDeleteJournalEntry(journal.id);
                                                                        // Update local UI immediately so it disappears
                                                                        setSelectedEntry(prev => prev ? ({
                                                                            ...prev,
                                                                            journals: prev.journals.filter(j => j.id !== journal.id)
                                                                        }) : null);
                                                                        setConfirmDeleteId(null);
                                                                    }}
                                                                    className="bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 transition-colors"
                                                                    title="确认删除"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setConfirmDeleteId(null);
                                                                    }}
                                                                    className="bg-stone-700 text-stone-300 p-1 rounded-full hover:bg-stone-600 transition-colors"
                                                                    title="取消"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setConfirmDeleteId(journal.id);
                                                                }}
                                                                className="text-stone-600 hover:text-rose-400 transition-colors p-1.5 rounded-full hover:bg-rose-500/10 active:scale-95"
                                                                title="删除"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {Array.isArray(journal.aiAnalysis?.emotionalState) && journal.aiAnalysis?.emotionalState.map((e, i) => (
                                                    <span key={i} className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded text-yellow-200">
                                                        {typeof e === 'object' ? (e as any).text || JSON.stringify(e) : e}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <p className="text-stone-200 font-serif leading-relaxed text-sm whitespace-pre-wrap">{journal.content}</p>
                                            
                                            {/* Traits & Blocks in Calendar */}
                                            {journal.aiAnalysis && (
                                                <div className="flex flex-wrap gap-2 mt-3 mb-2">
                                                    {journal.aiAnalysis.highSelfTraits?.map((t, i) => (
                                                        <span key={`trait-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-serif">
                                                            <Sparkles className="w-3 h-3 opacity-70" /> {typeof t === 'object' ? (t as any).text || 'Trait' : t}
                                                        </span>
                                                    ))}
                                                    {journal.aiAnalysis.blocksIdentified?.map((b, i) => (
                                                        <span key={`block-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 font-serif">
                                                            <AlertCircle className="w-3 h-3 opacity-70" /> {typeof b === 'object' ? (b as any).text || 'Block' : b}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {journal.aiAnalysis && (
                                                <div className="pt-4 border-t border-white/5 mt-4">
                                                    <h4 className="text-[10px] text-lucid-dim uppercase mb-2">AI Insight</h4>
                                                    <div className="text-xs text-stone-400 leading-relaxed">
                                                       <SimpleMarkdown content={typeof journal.aiAnalysis.summary === 'object' ? (journal.aiAnalysis.summary as any).text || JSON.stringify(journal.aiAnalysis.summary) : journal.aiAnalysis.summary} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8 pb-4">
                    {/* Vertical Scroll List of Months */}
                    {monthsToDisplay.map((dateObj, monthIdx) => {
                        const year = dateObj.getFullYear();
                        const month = dateObj.getMonth();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const firstDayOfMonth = new Date(year, month, 1).getDay();
                        
                        return (
                            <div key={monthIdx} className="animate-fade-in">
                                <div className="flex items-center gap-3 mb-3">
                                    <h3 className="text-lg font-serif text-white/90">{year}年 {month + 1}月</h3>
                                    <div className="h-[1px] flex-1 bg-white/5"></div>
                                </div>
                                
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-[10px] text-lucid-dim font-sans opacity-50">{d}</span>)}
                                </div>
                                
                                <div className="grid grid-cols-7 gap-2">
                                    {/* Empty cells for offset */}
                                    {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`}></div>)}
                                    
                                    {/* Days */}
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                        const day = i + 1;
                                        const currentDayDate = new Date(year, month, day);
                                        const dateKey = currentDayDate.toDateString();
                                        const entry = entriesByDay[dateKey];
                                        
                                        const hasJournal = entry && entry.journals.length > 0;
                                        const hasRitual = !!entry?.ritual;
                                        const hasEntry = hasJournal || hasRitual;
                                        
                                        // Calculate mood style based on ALL journals for that day
                                        let moodStyle = 'bg-transparent text-stone-700 hover:bg-white/5';
                                        
                                        if (hasJournal) {
                                            const allEmotions = entry.journals.flatMap(j => 
                                                Array.isArray(j.aiAnalysis?.emotionalState) 
                                                ? j.aiAnalysis?.emotionalState 
                                                : (typeof j.aiAnalysis?.emotionalState === 'string' ? [j.aiAnalysis.emotionalState] : [])
                                            ).filter(Boolean) as string[];
                                            
                                            const flatEmotions = allEmotions.map(e => typeof e === 'object' ? (e as any).text || '' : e).filter(e => e);
                                            
                                            moodStyle = getMoodStyle(flatEmotions);
                                        } else if (hasRitual) {
                                            moodStyle = 'bg-indigo-900/30 border-indigo-500/20 text-indigo-300';
                                        }

                                        const title = hasJournal 
                                          ? `${entry.journals.length} entries` 
                                          : '';

                                        return (
                                            <button
                                                key={day}
                                                onClick={() => hasEntry && setSelectedEntry({ 
                                                    journals: entry?.journals || [], 
                                                    ritual: entry?.ritual,
                                                    dateStr: currentDayDate.toLocaleDateString()
                                                })}
                                                disabled={!hasEntry}
                                                className={`
                                                    aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-serif transition-all relative border border-transparent
                                                    ${moodStyle}
                                                    ${hasEntry ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                                                `}
                                                title={title}
                                            >
                                                <span className={hasEntry ? 'font-medium' : ''}>{day}</span>
                                                {entry && entry.journals.length > 1 && (
                                                    <div className="absolute top-1 right-1 w-1 h-1 bg-white/50 rounded-full"></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default JournalCalendar;
