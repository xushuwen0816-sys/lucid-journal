import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { JournalEntry, RitualArchiveEntry } from '../types';
import { SimpleMarkdown } from './Shared';
import { ChevronLeft, CreditCard, Sun, Calendar as CalendarIcon, Check, X, Trash2, Sparkles, AlertCircle } from 'lucide-react';

interface JournalCalendarProps {
    initialDate?: Date | null;
    journalEntries: JournalEntry[];
    ritualEntries: RitualArchiveEntry[];
    onDeleteJournalEntry?: (id: string) => void;
    onDeleteRitual?: (id: string) => void;
    className?: string;
}

// Helper: Get Heatmap Color Class based on emotions (Duplicated for now, ideally in utils)
const getMoodStyle = (emotions: string[] = []): string => {
    if (!emotions || emotions.length === 0) return 'bg-white/[0.05] text-stone-400';

    const e = emotions.join(' ').toLowerCase();
    
    // 1. High Energy / Joy (Orange/Amber)
    if (e.match(/joy|happy|excited|confident|proud|喜悦|快乐|兴奋|自信|自豪|inspired|灵感/)) {
        return 'bg-orange-500/30 text-orange-100 shadow-[0_0_10px_rgba(249,115,22,0.2)]';
    }
    // 2. Love / Gratitude (Rose/Pink)
    if (e.match(/love|grateful|hope|爱|感恩|希望|touch|感动/)) {
        return 'bg-rose-500/30 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
    }
    // 3. Peace / Calm (Emerald/Teal)
    if (e.match(/peace|calm|content|relieved|平静|安宁|满足|释然|safe|安全/)) {
        return 'bg-emerald-500/30 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
    }
    // 4. Low Energy / Sadness (Indigo/Blue)
    if (e.match(/sad|lonely|tired|bored|hopeless|悲伤|孤独|疲惫|无聊|绝望|depress/)) {
        return 'bg-indigo-500/30 text-indigo-200';
    }
    // 5. Intense Negative / Anger (Red)
    if (e.match(/angry|frustrated|anxious|fear|guilty|愤怒|挫败|焦虑|恐惧|内疚|压力/)) {
        return 'bg-red-900/40 text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.2)]';
    }

    // Default active but unknown emotion (Khaki/Sand)
    // Using a custom hex for Khaki to be more accurate than stone/yellow
    return 'bg-[#C2B280]/20 text-[#E0D8B0]';
};

const JournalCalendar: React.FC<JournalCalendarProps> = ({ initialDate, journalEntries, ritualEntries, onDeleteJournalEntry, onDeleteRitual, className }) => {
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmDeleteRitualId, setConfirmDeleteRitualId] = useState<string | null>(null);

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
        
        // Ensure journals are sorted (Oldest first)
        Object.keys(map).forEach(key => {
            map[key].journals.sort((a,b) => a.date - b.date);
        });

        // Sort ritual entries by date ascending (Oldest -> Newest) before processing.
        // This ensures that when we merge duplicates (same day), the newer data overwrites the older data.
        // App.tsx typically prepends new entries ([New, Old]), so without sorting, we would process New then Old,
        // and our merge logic (Old || New) would result in Old data persisting.
        const sortedRituals = [...ritualEntries].sort((a, b) => a.date - b.date);

        sortedRituals.forEach(r => {
            const d = new Date(r.date).toDateString();
            if (!map[d]) {
                map[d] = { journals: [], ritual: undefined };
            }
            
            // Merge logic: If a ritual already exists for this day, merge the fields.
            // Since we are iterating Old -> New, 'r' is always the newer (or equal) entry.
            // We prioritize 'r's data if it exists.
            if (map[d].ritual) {
                map[d].ritual = {
                    ...map[d].ritual,
                    ...r,
                    reading: r.reading || map[d].ritual.reading,
                    oracleReading: r.oracleReading || map[d].ritual.oracleReading,
                    practice: r.practice || map[d].ritual.practice
                };
            } else {
                map[d].ritual = r;
            }
        });
        return map;
    }, [journalEntries, ritualEntries]);

    // Derived state for the selected entry details
    const selectedEntry = useMemo(() => {
        if (!selectedDateKey) return null;
        const entry = entriesByDay[selectedDateKey];
        if (!entry) return null; // Or return a structure with empty arrays if you want to show empty state for a valid date
        
        return {
            ...entry,
            dateStr: new Date(selectedDateKey).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        };
    }, [selectedDateKey, entriesByDay]);

    // Initialize selected entry from prop if provided
    useEffect(() => {
        if (initialDate) {
            const dateStr = initialDate.toDateString();
            if (entriesByDay[dateStr]) {
                setSelectedDateKey(dateStr);
            }
        }
    }, [initialDate]); // Removed entriesByDay from dependency to avoid resetting on data update if user navigated away? 
    // Actually, if we want initialDate to force open a date, we should keep it simple.
    // But usually initialDate is passed once on mount or when navigation happens.

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
        
        // Return months in ascending order (Oldest -> Newest)
        return result.reverse();
    }, [journalEntries, ritualEntries]);

    const bottomRef = useRef<HTMLDivElement>(null);
    const lastViewedDateRef = useRef<string | null>(null);
    const journalRef = useRef<HTMLDivElement>(null);
    const ritualRef = useRef<HTMLDivElement>(null);
    const detailContainerRef = useRef<HTMLDivElement>(null);
    const calendarContainerRef = useRef<HTMLDivElement>(null);
    const savedScrollTopRef = useRef<number>(0);

    // Scroll to specific section when opening a date
    useLayoutEffect(() => {
        if (selectedDateKey) {
            // Use setTimeout to ensure DOM is fully ready, though useLayoutEffect should suffice.
            // But we use scrollTop on container to avoid page jump.
            if (detailContainerRef.current) {
                const target = journalRef.current || ritualRef.current;
                if (target) {
                    // Calculate target position relative to the container
                    // We need to account for sticky header height (~50px)
                    // offsetTop is relative to the closest positioned ancestor.
                    // The container has relative position (flex child), so it should work.
                    // If target is nested deep, we might need more math, but structure is flat enough.
                    const top = target.offsetTop;
                    detailContainerRef.current.scrollTop = Math.max(0, top - 60); // 60px buffer
                }
            }
        }
    }, [selectedDateKey]);

    // Scroll to bottom on mount or when returning to calendar view
    useLayoutEffect(() => {
        if (!selectedDateKey) {
            if (savedScrollTopRef.current > 0 && calendarContainerRef.current) {
                calendarContainerRef.current.scrollTop = savedScrollTopRef.current;
            } else if (lastViewedDateRef.current) {
                const el = document.getElementById(`date-${lastViewedDateRef.current}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
                lastViewedDateRef.current = null;
            } else if (calendarContainerRef.current) {
                calendarContainerRef.current.scrollTop = calendarContainerRef.current.scrollHeight;
            }
        }
    }, [selectedDateKey, monthsToDisplay]);

    return (
        <div className={`flex flex-col h-full ${className || ''}`}>
            {selectedEntry ? (
                <div className="flex flex-col h-full overflow-hidden relative">
                    {/* Integrated Sticky Header - Minimal & Seamless */}
                    <div className="sticky top-0 z-30 flex items-center gap-4 py-4 px-4 md:px-6 bg-stone-900/10 backdrop-blur-md transition-all duration-300 shrink-0">
                        <button 
                            onClick={() => {
                                lastViewedDateRef.current = selectedDateKey;
                                setSelectedDateKey(null);
                            }} 
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-stone-400 hover:text-white transition-all border border-white/5 group"
                            title="返回日历"
                        >
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"/>
                        </button>
                        <span className="text-lg text-white/90 font-serif tracking-wide drop-shadow-sm">
                            {selectedEntry.dateStr}
                        </span>
                    </div>
                    
                    <div ref={detailContainerRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 pb-6 space-y-6 relative">
                    {/* Removed duplicated title since it's now in header */}


                    {/* Ritual Section */}
                    {selectedEntry.ritual && (
                        <div ref={ritualRef} className="space-y-4 pt-4 border-t border-white/10 scroll-mt-16">
                            {/* Ritual Section Header */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-stone-400 text-xs uppercase tracking-widest font-bold">
                                    <Sparkles className="w-3 h-3" /> Daily Ritual
                                </div>
                                
                                {/* Ritual Delete Button */}
                                {onDeleteRitual && (
                                    <div className="relative z-20 flex items-center">
                                        {confirmDeleteRitualId === selectedEntry.ritual.id ? (
                                            <div className="flex items-center gap-1 bg-stone-800 rounded-full px-1 py-0.5 border border-rose-500/30 animate-fade-in">
                                                <span className="text-[9px] text-rose-300 pl-1">删除?</span>
                                                <button 
                                                    onClick={() => {
                                                        onDeleteRitual(selectedEntry.ritual!.id);
                                                        setConfirmDeleteRitualId(null);
                                                    }}
                                                    className="bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 transition-colors"
                                                >
                                                    <Check className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={() => setConfirmDeleteRitualId(null)}
                                                    className="bg-stone-700 text-stone-300 p-1 rounded-full hover:bg-stone-600 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setConfirmDeleteRitualId(selectedEntry.ritual!.id)}
                                                className="text-stone-600 hover:text-rose-400 transition-colors p-1.5 rounded-full hover:bg-rose-500/10 active:scale-95"
                                                title="Delete Ritual"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

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

                            {selectedEntry.ritual.oracleReading && (
                                <div className="space-y-2 mt-4">
                                    <div className="flex items-center gap-2 text-purple-400 text-xs uppercase tracking-widest font-bold">
                                        <CreditCard className="w-3 h-3" /> Oracle Reading
                                    </div>
                                    <div className="flex justify-center gap-2 flex-wrap">
                                        {selectedEntry.ritual.oracleReading.cards.map((card, i) => (
                                            <div key={i} className={`min-w-[30%] p-2 bg-white/5 rounded-lg border border-white/10 text-center ${card.isReversed ? 'border-rose-500/20' : 'border-purple-500/20'}`}>
                                                <span className="text-[10px] text-stone-500 block uppercase">{card.position}</span>
                                                <div className="text-sm font-serif text-white my-1">{card.name}</div>
                                                <span className="text-[9px] block text-stone-500">{card.isReversed ? 'Reversed' : 'Upright'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                                        <p className="text-xs text-stone-300 font-serif leading-relaxed">
                                            {selectedEntry.ritual.oracleReading.guidance}
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
                                        <h3 className="text-lg font-serif text-emerald-100 mb-3 border-b border-emerald-500/10 pb-2">
                                            {selectedEntry.ritual.practice.energyStatus}
                                        </h3>
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
                    <div ref={journalRef} className="space-y-4 pt-4 border-t border-white/10 scroll-mt-16">
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
                                                                        // UI updates automatically via props -> derived state
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
                </div>
            ) : (
                <div ref={calendarContainerRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-8 p-4 md:p-6 pb-20">
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
                                    {['S','M','T','W','T','F','S'].map((d, i) => <span key={`${d}-${i}`} className="text-[10px] text-lucid-dim font-sans opacity-50">{d}</span>)}
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
                                            moodStyle = 'bg-transparent text-stone-200 hover:bg-white/5';
                                        }

                                        const title = hasJournal 
                                          ? `${entry.journals.length} entries` 
                                          : '';

                                        return (
                                            <button
                                                key={`${day}-${i}`}
                                                id={`date-${dateKey}`}
                                                onClick={() => {
                                                    if (hasEntry) {
                                                        if (calendarContainerRef.current) {
                                                            savedScrollTopRef.current = calendarContainerRef.current.scrollTop;
                                                        }
                                                        setSelectedDateKey(currentDayDate.toDateString());
                                                    }
                                                }}
                                                disabled={!hasEntry}
                                                className={`
                                                    aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-serif transition-all relative border border-transparent
                                                    ${moodStyle}
                                                    ${hasEntry ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                                                `}
                                                title={title}
                                            >
                                                <span className={hasEntry ? 'font-medium' : ''}>{day}</span>
                                                {entry && hasJournal && entry.journals.length > 1 && (
                                                    <div className="absolute top-1 right-1 w-1 h-1 bg-white/50 rounded-full"></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            )}
        </div>
    );
};

export default JournalCalendar;
