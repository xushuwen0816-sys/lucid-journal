
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Wish, FutureLetter, JournalEntry, RitualArchiveEntry } from '../types';
import { SectionTitle, Card, Button, LoadingSpinner, TabNav, Modal, SimpleMarkdown } from './Shared';
import { Archive, Mail, Clock, Send, Star, Lock, Unlock, Zap, ArrowRight, Sparkles, RefreshCw, Calendar as CalendarIcon, ChevronRight, ChevronLeft, CreditCard, Sun, Type, Filter, TrendingUp, AlertCircle, Smile, X, Download, ShieldCheck, FileText, Upload, Trash2, Check, PieChart as PieChartIcon, BarChart3, Search } from 'lucide-react';
import { generateFutureLetterReply, generateWeeklyReport } from '../services/geminiService';
import StatPieChart from './StatPieChart';
import StatDetailModal from './StatDetailModal';
import SentimentDetailModal, { processSentimentData } from './SentimentDetailModal';
import SentimentTrendChart from './SentimentTrendChart';
import JournalCalendar from './JournalCalendar';
import { useAuth } from '../contexts/AuthContext';

interface ArchiveViewProps {
  wishes: Wish[];
  journalEntries: JournalEntry[];
  ritualEntries: RitualArchiveEntry[];
  letters: FutureLetter[];
  onUpdateWish: (wish: Wish) => void;
  onDeleteWish: (id: string) => void;
  onAddLetter: (letter: FutureLetter) => void;
  onDeleteLetter: (id: string) => void;
  onDeleteRitual?: (id: string) => void;
  onImportData: (data: any) => void;
  onDeleteJournalEntry?: (id: string) => void;
  onUpdateJournalEntry?: (entry: JournalEntry) => void;
  initialTab?: 'milestones' | 'letters' | 'wishes' | 'library';
  onUpdateLetter?: (letter: FutureLetter) => void;
}

type DetailsType = 'wishes' | 'journals' | 'blocks' | 'traits' | 'emotions' | 'stat_emotions' | null;

// Helper: Get emotional score (valence)
const getSentimentScore = (emotion: string): number => {
    const map: Record<string, number> = {
        'joy': 9, 'happy': 8, 'excited': 8, 'grateful': 9, 'peaceful': 7, 'calm': 7, 'hopeful': 8, 'confident': 9,
        'inspired': 9, 'love': 10, 'content': 7, 'proud': 8, 'relieved': 7,
        'neutral': 5, 'okay': 5,
        'tired': 4, 'bored': 4, 'confused': 4, 'anxious': 3, 'sad': 3, 'angry': 2, 'frustrated': 3, 'overwhelmed': 2,
        'lonely': 2, 'guilty': 2, 'ashamed': 1, 'hopeless': 1, 'fear': 2,
        // Chinese translations
        '喜悦': 9, '快乐': 8, '兴奋': 8, '感恩': 9, '平静': 7, '安宁': 7, '希望': 8, '自信': 9,
        '灵感': 9, '爱': 10, '满足': 7, '自豪': 8, '释然': 7,
        '平淡': 5, '还好': 5,
        '疲惫': 4, '无聊': 4, '困惑': 4, '焦虑': 3, '悲伤': 3, '愤怒': 2, '挫败': 3, '压力': 2,
        '孤独': 2, '内疚': 2, '羞愧': 1, '绝望': 1, '恐惧': 2, '烦躁': 3, '自我批评': 2
    };
    
    const lower = emotion.toLowerCase();
    if (map[lower]) return map[lower];
    for (const key in map) {
        if (lower.includes(key)) return map[key];
    }
    return 5; 
};


// Helper: Sort map by value desc
const sortAndSlice = (map: Record<string, number>, limit: number = 10) => {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
};

const STICKY_STYLES = [
    { bg: 'bg-[#F2EFE9]', text: 'text-stone-800', border: 'border-stone-900/5', tagBg: 'bg-stone-800/5', tagText: 'text-stone-600', metaText: 'text-stone-400' }, // Classic Cream
    { bg: 'bg-[#E8DCC4]', text: 'text-stone-800', border: 'border-stone-900/5', tagBg: 'bg-[#C9A66B]/10', tagText: 'text-[#8C734B]', metaText: 'text-[#8C734B]/70' }, // Warm Beige
    { bg: 'bg-[#E0D2C7]', text: 'text-stone-800', border: 'border-stone-900/5', tagBg: 'bg-[#BF8C7E]/10', tagText: 'text-[#8C6056]', metaText: 'text-[#8C6056]/70' }, // Dusty Roseish
    { bg: 'bg-[#CED9D0]', text: 'text-stone-800', border: 'border-stone-900/5', tagBg: 'bg-[#7E9C84]/10', tagText: 'text-[#566B5A]', metaText: 'text-[#566B5A]/70' }, // Sage
    { bg: 'bg-[#CBD4DB]', text: 'text-stone-800', border: 'border-stone-900/5', tagBg: 'bg-[#7E8C9C]/10', tagText: 'text-[#56606B]', metaText: 'text-[#56606B]/70' }, // Blue Grey
    { bg: 'bg-gradient-to-br from-[#F2EFE9] to-[#E6D4CE]', text: 'text-stone-800', border: 'border-stone-900/5', tagBg: 'bg-[#D68C70]/10', tagText: 'text-[#9C604B]', metaText: 'text-[#9C604B]/70' }, // Gradient Orange-ish
];

const getStableRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return hash;
};

const getWishPhase = (wish: Wish) => {
    if (wish.status === 'manifested') return { 
        name: '★ 已显化 Manifested', 
        className: 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20',
        border: 'border-emerald-500/30' 
    };
    return { 
        name: '● 进行中 In Progress', 
        className: 'bg-stone-900/5 text-stone-600 border-stone-900/10',
        border: 'border-stone-900/10' 
    };
};

const WishStickyNote: React.FC<{
    wish: Wish;
    constraintsRef: React.RefObject<any>;
    bringToFront: (id: string) => void;
    setSelectedWish: (wish: Wish) => void;
    zIndex: number;
    position?: { x: number; y: number };
    onPositionChange: (id: string, pos: { x: number; y: number }) => void;
}> = ({ wish, constraintsRef, bringToFront, setSelectedWish, zIndex, position, onPositionChange }) => {
    const isDragging = useRef(false);
    const phase = getWishPhase(wish);
    const days = Math.floor((Date.now() - wish.createdAt) / (1000 * 60 * 60 * 24));
    
    const seed = getStableRandom(wish.id + 'v2');
    const rotate = (seed % 10) - 5; 
    const currentX = position?.x ?? 0;
    const currentY = position?.y ?? 0;

    const x = useMotionValue(currentX);
    const y = useMotionValue(currentY);

    // Update MotionValues when position changes (e.g. initial load or reset)
    useEffect(() => {
        if (!isDragging.current) {
            x.set(currentX);
            y.set(currentY);
        }
    }, [currentX, currentY]);

    const styleIndex = Math.abs(seed) % STICKY_STYLES.length;
    const style = STICKY_STYLES[styleIndex];

    // Only render if we have a valid position (prevent jumping from 0,0)
    if (!position) return null;

    return (
        <motion.div 
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragStart={() => {
                isDragging.current = true;
                bringToFront(wish.id);
            }}
            onDragEnd={() => {
                onPositionChange(wish.id, { x: x.get(), y: y.get() });
                // Small delay to prevent click event from firing immediately after drag
                setTimeout(() => { isDragging.current = false; }, 50);
            }}
            onClick={(e) => {
                if (isDragging.current) {
                    e.stopPropagation();
                    return;
                }
                bringToFront(wish.id);
                setSelectedWish(wish);
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
                opacity: 1, 
                scale: 1,
                rotate: rotate,
            }}
            whileHover={{ scale: 1.05, rotate: 0, zIndex: 100 }}
            whileDrag={{ scale: 1.1, rotate: 0, zIndex: 101, cursor: 'grabbing' }}
            style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: zIndex,
                x,
                y,
                touchAction: 'none'
            }}
            className={`relative w-64 ${style.bg} border ${style.border} rounded-sm p-5 cursor-grab
                shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col backdrop-blur-sm
                group transition-all duration-500 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)]`}
        >
            {/* Paper Texture/Highlight */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.4] to-transparent pointer-events-none rounded-sm mix-blend-soft-light"></div>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/40 opacity-50"></div>
            
            <div className="relative z-10 flex-1 pointer-events-none flex flex-col">
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] font-sans tracking-widest px-2 py-0.5 rounded-sm border ${phase.className}`}>
                        {phase.name}
                    </span>
                    <span className={`text-[10px] ${style.metaText} font-serif italic`}>{days}d</span>
                </div>
                
                <h3 className={`text-lg font-serif ${style.text} leading-relaxed tracking-wide line-clamp-[8] flex-1 min-h-[60px]`}>
                    {wish.content}
                </h3>
            </div>

            <div className="relative z-10 mt-3 pointer-events-none">
                <div className="flex flex-wrap gap-1.5 mb-1">
                    {wish.tags?.emotional?.slice(0, 3).map((tag, i) => (
                        <span key={i} className={`text-[9px] uppercase tracking-wider ${style.tagText} ${style.tagBg} px-1.5 py-0.5 rounded border border-stone-900/5`}>
                            #{typeof tag === 'object' ? 'Tag' : tag}
                        </span>
                    ))}
                </div>
                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowRight className={`w-4 h-4 ${style.text} opacity-50`} />
                </div>
            </div>
        </motion.div>
    );
};

const ArchiveView: React.FC<ArchiveViewProps> = ({ wishes, journalEntries, ritualEntries, letters, onUpdateWish, onDeleteWish, onAddLetter, onDeleteLetter, onDeleteRitual, onImportData, onDeleteJournalEntry, onUpdateJournalEntry, initialTab = 'milestones', onUpdateLetter }) => {
  // Priority: Insights (Milestones) -> Time Capsule -> Wishes -> Library
  const [tab, setTab] = useState<'milestones' | 'letters' | 'wishes' | 'library'>(initialTab);
  
  // Sync tab if initialTab prop changes (e.g. redirected from creating a wish)
  useEffect(() => {
      if (initialTab) {
          setTab(initialTab);
      }
  }, [initialTab]);
  
  // --- Wish State ---
  const [selectedWish, setSelectedWish] = useState<Wish | null>(null);

  // --- Affirmation Library State ---
  const [selectedWishId, setSelectedWishId] = useState<string>('');
  const [affirmationViewMode, setAffirmationViewMode] = useState<'all' | 'single'>('all');

  useEffect(() => {
    if (wishes.length > 0 && !selectedWishId) {
        setSelectedWishId(wishes[0].id);
    }
  }, [wishes, selectedWishId]);

  const targetWish = wishes.find(w => w.id === selectedWishId);

  // --- Milestones State ---
  const [reportLoading, setReportLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(() => {
      return localStorage.getItem('lucid_weekly_report_content');
  });
  const [detailsModal, setDetailsModal] = useState<DetailsType>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDateForCalendar, setSelectedDateForCalendar] = useState<Date | null>(null);
  const [journalSearch, setJournalSearch] = useState('');
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<JournalEntry | null>(null);
  
  // Scroll Management Refs
  const journalListRef = useRef<HTMLDivElement>(null);
  const journalDetailRef = useRef<HTMLDivElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const savedJournalScrollTop = useRef<number>(0);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Force scroll to top on mount
  useLayoutEffect(() => {
      if (mainContainerRef.current) {
          mainContainerRef.current.scrollTop = 0;
      }
  }, []);

  // Restore/Reset scroll position using Modal Body
  React.useLayoutEffect(() => {
      if (detailsModal === 'journals' && modalBodyRef.current) {
          if (selectedJournalEntry) {
              // Entering detail view: Scroll to top
              requestAnimationFrame(() => {
                  if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
              });
          } else {
              // Returning to list view: Restore position
              requestAnimationFrame(() => {
                  if (modalBodyRef.current) {
                      modalBodyRef.current.scrollTop = savedJournalScrollTop.current;
                  }
              });
          }
      }
  }, [selectedJournalEntry, detailsModal]);
  
  // --- Letters State ---
  const [letterInput, setLetterInput] = useState('');
  const [letterDelay, setLetterDelay] = useState<number>(30); // days
  const [isSending, setIsSending] = useState(false);
  const [showLetterInput, setShowLetterInput] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<FutureLetter | null>(null);
  const [confirmDeleteLetterId, setConfirmDeleteLetterId] = useState<string | null>(null);
  
  const { token } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef(null);
  const [zIndices, setZIndices] = useState<Record<string, number>>({});
  const [wishPositions, setWishPositions] = useState<Record<string, { x: number; y: number }>>({});

    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
      const saved = localStorage.getItem('lucid_wish_positions');
      if (saved) {
          try {
              setWishPositions(JSON.parse(saved));
          } catch (e) {
              console.error('Failed to parse wish positions', e);
          }
      }
  }, []);

  useEffect(() => {
      const updateSize = () => {
            if (constraintsRef.current) {
                const { offsetWidth, offsetHeight } = constraintsRef.current;
                setContainerSize({ width: offsetWidth, height: offsetHeight });
            }
        };
        
        // Initial size
        updateSize();
        
        // Resize observer would be better, but window resize is okay for now
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [tab]);

    // Initialize positions for unsaved wishes
    useEffect(() => {
        if (containerSize.width === 0) return;

        setWishPositions(prev => {
            const newPositions = { ...prev };
            let hasUpdates = false;
            
            // Grid configuration
            const CARD_WIDTH = 280; // approximate width + gap
            const CARD_HEIGHT = 320;
            const cols = Math.floor(containerSize.width / CARD_WIDTH) || 1;
            
            wishes.forEach((wish, index) => {
                if (!newPositions[wish.id]) {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    
                    // Add some randomness to the grid
                    const seed = getStableRandom(wish.id);
                    const randomX = (seed % 40) - 20;
                    const randomY = ((seed >> 2) % 40) - 20;

                    newPositions[wish.id] = {
                        x: (col * CARD_WIDTH) + 50 + randomX,
                        y: (row * CARD_HEIGHT) + 50 + randomY
                    };
                    hasUpdates = true;
                }
            });

            return hasUpdates ? newPositions : prev;
        });
    }, [wishes, containerSize.width]);

    const handleWishPositionChange = (id: string, pos: { x: number; y: number }) => {
        setWishPositions(prev => {
            const next = { ...prev, [id]: pos };
            localStorage.setItem('lucid_wish_positions', JSON.stringify(next));
            return next;
        });
    };

  const bringToFront = (id: string) => {
      setZIndices(prev => {
          const values = Object.values(prev) as number[];
          const currentMax = Math.max(0, ...values);
          return { ...prev, [id]: currentMax + 1 };
      });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current && !letterInput) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
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

  // --- Derived Stats for Milestones ---
  const stats = useMemo(() => {
     const totalEntries = journalEntries.length;
     const manifestedWishes = wishes.filter(w => w.status === 'manifested').length;
     
     const emotionCounts: Record<string, number> = {};
     const blockCounts: Record<string, number> = {};
     const traitCounts: Record<string, number> = {};
     
     const allBlocksRaw: { text: string, date: number, entryId: string }[] = [];
     const allTraitsRaw: { text: string, date: number }[] = [];
     const sentimentData: { date: number, score: number, emotions: string[] }[] = [];

     // Sort entries by date ascending for chart
     const sortedEntries = [...journalEntries].sort((a, b) => a.date - b.date);
     
     sortedEntries.forEach(entry => {
         if(entry.aiAnalysis) {
             // 1. Sanitize Emotions
             let rawEmotions = entry.aiAnalysis.emotionalState;
             if (!Array.isArray(rawEmotions)) {
                 rawEmotions = typeof rawEmotions === 'string' ? [rawEmotions] : [];
             }
             const emotions = rawEmotions.map((e: any) => {
                 if (typeof e === 'object' && e !== null) return e.text || e.title || JSON.stringify(e);
                 return String(e);
             }).filter(s => s);

             let entryScoreSum = 0;
             emotions.forEach(em => {
                 if (em) {
                    const cleanEm = em.trim();
                    emotionCounts[cleanEm] = (emotionCounts[cleanEm] || 0) + 1;
                    entryScoreSum += getSentimentScore(cleanEm);
                 }
             });
             
             if (emotions.length > 0) {
                 sentimentData.push({
                     date: entry.date,
                     score: entryScoreSum / emotions.length,
                     emotions: emotions
                 });
             }
             
             // 2. Sanitize Blocks
             let rawBlocks = entry.aiAnalysis.blocksIdentified;
             if (Array.isArray(rawBlocks)) {
                 rawBlocks.forEach((b: any) => {
                     let cleanB = "";
                     if (typeof b === 'object' && b !== null) cleanB = b.text || b.content || JSON.stringify(b);
                     else cleanB = String(b);
                     
                     if (cleanB) {
                        cleanB = cleanB.trim();
                        if (cleanB) {
                            allBlocksRaw.push({ text: cleanB, date: entry.date, entryId: entry.id });
                            blockCounts[cleanB] = (blockCounts[cleanB] || 0) + 1;
                        }
                     }
                 });
             }

             // 3. Sanitize Traits
             let rawTraits = entry.aiAnalysis.highSelfTraits;
             if (Array.isArray(rawTraits)) {
                 rawTraits.forEach((t: any) => {
                     let cleanT = "";
                     if (typeof t === 'object' && t !== null) cleanT = t.text || t.content || JSON.stringify(t);
                     else cleanT = String(t);

                     if (cleanT) {
                         cleanT = cleanT.trim();
                         if (cleanT) {
                             allTraitsRaw.push({ text: cleanT, date: entry.date });
                             traitCounts[cleanT] = (traitCounts[cleanT] || 0) + 1;
                         }
                     }
                 });
             }
         }
     });

     const uniqueBlocks = Object.keys(blockCounts);
     const uniqueTraits = Object.keys(traitCounts);
     
     // Convert to array format for charts
     const allEmotionsList = Object.entries(emotionCounts).map(([name, count]) => ({ name, count }));
     const allBlocksList = Object.entries(blockCounts).map(([name, count]) => ({ name, count }));
     const allTraitsList = Object.entries(traitCounts).map(([name, count]) => ({ name, count }));
     
     // Process sentiment data for chart (Last 30 days)
     const sentimentTrendData = processSentimentData(journalEntries, 30);

     const topEmotions = sortAndSlice(emotionCounts, 20);
     const topBlocks = sortAndSlice(blockCounts, 20);
     const topTraits = sortAndSlice(traitCounts, 20);

     return { 
         totalEntries, 
         manifestedWishes,
         allBlocksRaw, 
         uniqueBlocks, 
         allTraitsRaw, 
         uniqueTraits, 
         topEmotions, // [name, count][]
         topBlocks,   // [name, count][]
         topTraits,   // [name, count][]
         allEmotionsList,
         allBlocksList,
         allTraitsList,
         sentimentTrendData,
         emotionCountsTotal: Object.values(emotionCounts).reduce((a,b)=>a+b,0),
         blocksCountsTotal: Object.values(blockCounts).reduce((a,b)=>a+b,0),
         traitsCountsTotal: Object.values(traitCounts).reduce((a,b)=>a+b,0),
     };
  }, [journalEntries, wishes]);

  // Check for unlocked letters
  const hasUnlockedLetters = useMemo(() => {
      return letters.some(l => !l.isLocked && Date.now() >= l.sendDate && !l.isRead);
  }, [letters]);

  // Mark letter as read when opened and unlocked
  useEffect(() => {
    if (selectedLetter && !selectedLetter.isLocked && !selectedLetter.isRead && onUpdateLetter) {
        onUpdateLetter({
            ...selectedLetter,
            isRead: true
        });
        setSelectedLetter(prev => prev ? ({ ...prev, isRead: true }) : null);
    }
  }, [selectedLetter, onUpdateLetter]);

  // --- Auto Generate Report Logic ---
  useEffect(() => {
    if (tab === 'milestones') {
        const checkAndGenerateReport = async () => {
            const now = new Date();
            const day = now.getDay(); // 0 is Sunday
            const hour = now.getHours();
            
            const lastGenTimestamp = localStorage.getItem('lucid_weekly_report_date');
            let shouldGenerate = false;

            const hasEntries = journalEntries.length > 0;
            const isSundayEvening = day === 0 && hour >= 20;

            if (!lastGenTimestamp) {
                if (hasEntries && isSundayEvening) {
                    shouldGenerate = true;
                }
            } else {
                const lastGen = new Date(parseInt(lastGenTimestamp));
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                
                if (now.getTime() - lastGen.getTime() > oneWeek && hasEntries) {
                     shouldGenerate = true;
                } 
                else if (isSundayEvening && now.toDateString() !== lastGen.toDateString() && hasEntries) {
                     shouldGenerate = true;
                }
            }

            if (shouldGenerate && !reportLoading) {
                setReportLoading(true);
                const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                const recentEntries = journalEntries.filter(e => e.date > oneWeekAgo);
                
                const entriesToAnalyze = recentEntries.length > 0 ? recentEntries : journalEntries.slice(0, 5);
                
                const report = await generateWeeklyReport(entriesToAnalyze);
                setAiReport(report);
                localStorage.setItem('lucid_weekly_report_content', report);
                localStorage.setItem('lucid_weekly_report_date', Date.now().toString());
                setReportLoading(false);
            }
        };
        checkAndGenerateReport();
    }
  }, [tab, journalEntries, reportLoading]);

  // --- Handlers ---
  
  const handleGenerateReport = async () => {
      setReportLoading(true);
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentEntries = journalEntries.filter(e => e.date > oneWeekAgo);
      const entriesToUse = recentEntries.length > 0 ? recentEntries : journalEntries.slice(0, 10);

      const report = await generateWeeklyReport(entriesToUse);
      setAiReport(report);
      localStorage.setItem('lucid_weekly_report_content', report);
      localStorage.setItem('lucid_weekly_report_date', Date.now().toString());
      setReportLoading(false);
  };

  const handleDeleteBlock = (entryId: string, blockText: string) => {
      if (!onUpdateJournalEntry) return;
      if (!window.confirm(`确定要删除信念 "${blockText}" 吗？这会更新对应的日记记录。`)) return;

      const entry = journalEntries.find(e => e.id === entryId);
      if (entry && entry.aiAnalysis && entry.aiAnalysis.blocksIdentified) {
          const updatedBlocks = entry.aiAnalysis.blocksIdentified.filter((b: any) => {
              const t = typeof b === 'object' ? b.text || b.content || JSON.stringify(b) : String(b);
              return t !== blockText;
          });
          
          const updatedEntry = {
              ...entry,
              aiAnalysis: {
                  ...entry.aiAnalysis,
                  blocksIdentified: updatedBlocks
              }
          };
          onUpdateJournalEntry(updatedEntry);
      }
  };

  const handleExportJSON = () => {
      const data = {
        meta: {
            app: "LUCID Journal",
            version: "1.0",
            exportDate: new Date().toISOString(),
            user: localStorage.getItem('lucid_user_name') || "Traveler"
        },
        data: {
            wishes,
            journalEntries,
            ritualEntries,
            letters,
        }
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LUCID_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleExportHTML = () => {
      const userName = localStorage.getItem('lucid_user_name') || "Traveler";
      const now = new Date();

      // Pre-process ritual entries to merge duplicates (same day)
      // Sort ritualEntries ascending (Old -> New) to ensure correct merging order
      // This ensures that newer updates (e.g. re-drawing cards) overwrite older ones for the same day
      const sortedRitualEntries = [...ritualEntries].sort((a, b) => a.date - b.date);

      const mergedRituals: Record<string, RitualArchiveEntry> = {};
      sortedRitualEntries.forEach(r => {
          const d = new Date(r.date).toDateString();
          if (mergedRituals[d]) {
              mergedRituals[d] = {
                  ...mergedRituals[d],
                  ...r,
                  reading: r.reading || mergedRituals[d].reading,
                  oracleReading: r.oracleReading || mergedRituals[d].oracleReading,
                  practice: r.practice || mergedRituals[d].practice
              };
          } else {
              mergedRituals[d] = r;
          }
      });
      // Sort by date descending
      const uniqueRitualEntries = Object.values(mergedRituals).sort((a, b) => b.date - a.date);
      
      const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LUCID 灵魂档案 | ${userName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600&display=swap');
  body { 
    background-color: #1C1917; 
    color: #E7E5E4; 
    font-family: 'Noto Serif SC', 'Georgia', serif; 
    padding: 40px 20px; 
    max-width: 800px; 
    margin: 0 auto; 
    line-height: 1.8; 
  }
  a { color: #FDBA74; text-decoration: none; }
  .header { text-align: center; margin-bottom: 60px; border-bottom: 1px solid #333; padding-bottom: 40px; }
  h1 { color: #FDBA74; font-weight: 300; letter-spacing: 0.2em; margin-bottom: 10px; }
  .meta { color: #78716C; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.1em; }
  
  h2 { 
    color: #E7E5E4; 
    font-weight: 400;
    margin-top: 60px; 
    margin-bottom: 30px; 
    display: flex; 
    align-items: center; 
    gap: 10px; 
    border-left: 3px solid #FDBA74; 
    padding-left: 15px; 
  }
  
  .card { 
    background: rgba(255,255,255,0.03); 
    border: 1px solid rgba(255,255,255,0.05); 
    padding: 25px; 
    border-radius: 12px; 
    margin-bottom: 25px; 
    page-break-inside: avoid;
  }
  
  .card-header { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px; }
  .date { color: #78716C; font-size: 0.8em; font-family: sans-serif; letter-spacing: 0.05em; }
  .status { background: rgba(253,186,116,0.1); color: #FDBA74; padding: 2px 8px; border-radius: 4px; font-size: 0.7em; }
  
  .wish-content { font-size: 1.2em; color: #FFF; margin-bottom: 15px; }
  .affirmations { margin-top: 15px; padding-left: 15px; border-left: 2px solid rgba(253,186,116,0.2); }
  .affirmation-text { color: #A8A29E; font-style: italic; font-size: 0.9em; margin-bottom: 5px; }
  
  .journal-content { white-space: pre-wrap; color: #D6D3D1; }
  .ai-insight { margin-top: 20px; padding: 15px; background: rgba(253,186,116,0.05); border-radius: 8px; font-size: 0.9em; color: #D6D3D1; }
  .insight-label { color: #FDBA74; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 5px; }

  .letter-content { white-space: pre-wrap; color: #D6D3D1; }
  .reply { margin-top: 20px; color: #FDBA74; font-style: italic; padding-left: 20px; border-left: 1px solid #FDBA74; }

  .tarot-cards { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
  .tarot-card { border: 1px solid rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 4px; font-size: 0.9em; color: #E7E5E4; background: rgba(0,0,0,0.2); }

  .footer { text-align: center; margin-top: 80px; font-size: 0.8em; color: #444; border-top: 1px solid #222; padding-top: 20px; }
  
  @media print {
    body { background: #FFF; color: #000; }
    .card { background: #FFF; border: 1px solid #EEE; color: #000; }
    h1, h2, a { color: #000; }
    .status { background: #EEE; color: #000; }
    .ai-insight { background: #F9F9F9; color: #333; }
    .tarot-card { border: 1px solid #CCC; color: #000; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>LUCID 灵魂档案</h1>
    <div class="meta">Owner: ${userName} · Exported on ${now.toLocaleDateString()}</div>
  </div>

  <h2>✨ 愿望清单 (Wishes)</h2>
  ${wishes.length > 0 ? wishes.map(w => `
    <div class="card">
      <div class="card-header">
        <span class="date">创建于 ${new Date(w.createdAt).toLocaleDateString()}</span>
        <span class="status">${w.status === 'manifested' ? '已显化 MANIFESTED' : '进行中 ACTIVE'}</span>
      </div>
      <div class="wish-content">${w.content}</div>
      <div class="affirmations">
        ${w.affirmations.map(a => `<div class="affirmation-text">" ${a.text} "</div>`).join('')}
      </div>
    </div>
  `).join('') : '<p style="text-align:center; color:#555;">暂无愿望记录</p>'}

  <h2>🔮 灵感塔罗 & 今日练习 (Rituals & Practice)</h2>
  ${uniqueRitualEntries.filter(r => r.reading || r.oracleReading || r.practice).length > 0 ? uniqueRitualEntries.filter(r => r.reading || r.oracleReading || r.practice).map(r => `
    <div class="card">
      <div class="card-header">
        <span class="date">${new Date(r.date).toLocaleString()}</span>
      </div>
      
      ${r.reading ? `
      <div style="margin-bottom: 15px;">
          <div style="font-size: 0.8em; color: #FDBA74; text-transform: uppercase; margin-bottom: 5px;">Tarot Reading</div>
          <div class="tarot-cards">
             ${r.reading.cards.map(c => `
                <div class="tarot-card">
                   ${c.position}: ${c.name} (${c.isReversed ? '逆' : '正'})
                </div>
             `).join('')}
          </div>
          <div class="journal-content" style="font-style: italic; color: #FDBA74;">
             " ${r.reading.guidance} "
          </div>
      </div>
      ` : ''}

      ${r.oracleReading ? `
      <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
          <div style="font-size: 0.8em; color: #C084FC; text-transform: uppercase; margin-bottom: 5px;">Oracle Reading</div>
          <div class="tarot-cards">
             ${r.oracleReading.cards.map(c => `
                <div class="tarot-card" style="border-color: rgba(192, 132, 252, 0.3); color: #E9D5FF;">
                   ${c.position}: ${c.name} (${c.isReversed ? '逆' : '正'})
                </div>
             `).join('')}
          </div>
          <div class="journal-content" style="font-style: italic; color: #C084FC;">
             " ${r.oracleReading.guidance} "
          </div>
      </div>
      ` : ''}

      ${r.practice ? `
      <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
          <div style="font-size: 0.8em; color: #10B981; text-transform: uppercase; margin-bottom: 5px;">Daily Practice</div>
          <h3 style="color: #D1FAE5; font-size: 1.1em; margin: 10px 0; font-weight: normal;">${r.practice.energyStatus}</h3>
          <div style="margin-bottom: 10px;">
              <span style="color: #6EE7B7; font-size: 0.8em;">AFFIRMATION:</span>
              <div style="color: #FFF; font-style: italic;">"${r.practice.todaysAffirmation}"</div>
          </div>
          <div>
              <span style="color: #6EE7B7; font-size: 0.8em;">ACTION:</span>
              <div style="color: #D6D3D1;">${r.practice.actionStep}</div>
          </div>
      </div>
      ` : ''}
    </div>
  `).join('') : '<p style="text-align:center; color:#555;">暂无仪式记录</p>'}

  <h2>📖 觉察日记 (Journal Highlights)</h2>
  ${journalEntries.length > 0 ? journalEntries.slice(0, 50).map(j => `
    <div class="card">
      <div class="card-header">
        <span class="date">${new Date(j.date).toLocaleString()}</span>
      </div>
      <div class="journal-content">${j.content}</div>
      ${j.aiAnalysis ? `<div class="ai-insight"><span class="insight-label">LUCID 洞见</span>${j.aiAnalysis.summary.replace(/\\n/g, '<br/>').replace(/\n/g, '<br/>')}</div>` : ''}
    </div>
  `).join('') : '<p style="text-align:center; color:#555;">暂无日记记录</p>'}

  <h2>📮 时空信箱 (Time Capsule)</h2>
  ${letters.length > 0 ? letters.map(l => `
    <div class="card">
      <div class="card-header">
        <span class="date">书写于 ${new Date(l.createdAt).toLocaleDateString()}</span>
        <span class="status">解锁日期: ${new Date(l.sendDate).toLocaleDateString()}</span>
      </div>
      <div class="letter-content">${l.content}</div>
      ${l.aiReply ? `<div class="reply">Future Self:<br/>${l.aiReply.replace(/\n/g, '<br/>')}</div>` : ''}
    </div>
  `).join('') : '<p style="text-align:center; color:#555;">暂无信件记录</p>'}
  
  <div class="footer">
    <p>Generated by LUCID Journal<br/>潜意识操作系统</p>
  </div>
</body>
</html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LUCID_Report_${userName}_${now.toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const result = event.target?.result as string;
              const parsed = JSON.parse(result);
              onImportData(parsed);
          } catch (err) {
              alert("文件解析失败，请确保上传的是有效的 JSON 备份文件。");
          }
      };
      reader.readAsText(file);
      // Reset input value so same file can be selected again
      e.target.value = '';
  };

  const handleSendLetter = async () => {
    if(!letterInput.trim()) return;
    setIsSending(true);
    
    // Calculate unlock time
    const unlockTime = Date.now() + (letterDelay * 24 * 60 * 60 * 1000); 
    // Give AI some time (e.g. 2 minutes) if sending immediately, to avoid sending email before AI reply is synced
    const actualUnlockTime = letterDelay === 0 ? Date.now() + 120000 : unlockTime;

    // Generate ID upfront
    const newLetterId = crypto.randomUUID();

    // 1. Initial Save (Optimistic & Data Safety)
    // Save the letter immediately without AI reply to ensure data persistence
    const initialLetterData = {
        id: newLetterId,
        content: letterInput,
        sendDate: actualUnlockTime,
        aiReply: null, // Placeholder
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
              aiReply: "（网络连接中断，AI 回信暂不可用）",
              isLocked: true
            };
            onAddLetter(newLetter);
            alert('网络连接不稳定，信件已保存在本地。');
            setLetterInput('');
            setIsSending(false);
            setShowLetterInput(false);
            return; // Exit, do not attempt AI
    }

    // SUCCESS: Notify User & Reset UI IMMEDIATELY (Non-blocking AI)
    setIsSending(false);
    setLetterInput('');
    setShowLetterInput(false);
    alert('信件已寄出！未来维度的回信正在生成中...');

    // 2. Background AI & Update (Step 2 & 3)
    // Run this asynchronously without blocking the UI
    (async () => {
        try {
            console.log('Step 2: Generating AI reply (Background)...');
            const aiResponse = await generateFutureLetterReply(letterInput);
            
            if (savedToServer && savedLetterResult) {
                console.log('Step 3: Updating letter with AI reply (Background)...');
                const updatedLetter = {
                    ...savedLetterResult,
                    aiReply: aiResponse
                };

                if (onUpdateLetter) {
                    onUpdateLetter(updatedLetter);
                } else {
                    // Fallback
                     const baseUrl = import.meta.env.VITE_API_URL || '';
                     await fetch(`${baseUrl}/api/letters`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json', 
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify(updatedLetter)
                    });
                }
            }
        } catch (error) {
            console.error("Background AI generation/update failed:", error);
            // We don't alert the user here as they might have moved on.
            // The letter is already saved (Step 1), just without AI reply.
        }
    })();
  };

  const toggleWishStatus = () => {
      if (!selectedWish) return;
      const newStatus = selectedWish.status === 'active' ? 'manifested' : 'active';
      const updatedWish = { ...selectedWish, status: newStatus as any };
      onUpdateWish(updatedWish);
      setSelectedWish(updatedWish); 
  };

  const handleDeleteWishClick = (id: string) => {
      if (window.confirm('确定要彻底删除这个愿望吗？此操作无法撤销。\nAre you sure you want to delete this wish permanently?')) {
          onDeleteWish(id);
          setSelectedWish(null);
      }
  };

  // --- Sub-components ---
  





  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative w-full flex flex-col md:flex-row items-center justify-center min-h-[60px] mb-6 mt-2 shrink-0">
        <div className="w-full md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 md:w-auto z-0 pointer-events-none">
            <SectionTitle title="我的时空" subtitle="ARCHIVE · 个人状态" className="pr-4 md:pr-0" />
        </div>
        
        <div className="z-10 mt-4 md:mt-0">
            <TabNav 
                activeTab={tab}
                onTabChange={setTab}
                tabs={[
                    { id: 'milestones', icon: Zap, label: '生命洞察' },
                    { id: 'letters', icon: Clock, label: '时间胶囊', badge: hasUnlockedLetters },
                    { id: 'wishes', icon: Star, label: '愿望列表' },
                    { id: 'library', icon: Type, label: '肯定语库' },
                ]}
            />
        </div>
      </div>

      <div ref={mainContainerRef} className="flex-1 overflow-y-auto px-4 custom-scrollbar animate-fade-in pb-20">
        <div className="max-w-5xl mx-auto w-full">
            
            {/* 1. INSIGHTS DASHBOARD */}
            {tab === 'milestones' && (
                <div className="space-y-6 animate-fade-in pt-4">
                    
                    {/* TOP STATS GRID (4 Columns) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        <Card onClick={() => setDetailsModal('journals')} className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-orange-900/10 to-transparent cursor-pointer hover:bg-white/5 group border-white/5">
                            <span className="text-2xl md:text-3xl font-serif text-white mb-1 group-hover:scale-110 transition-transform">{stats.totalEntries}</span>
                            <span className="text-[10px] md:text-xs text-lucid-dim uppercase tracking-widest flex items-center gap-1">觉察日记 Journals</span>
                        </Card>
                        
                        <Card onClick={() => setDetailsModal('wishes')} className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-emerald-900/10 to-transparent cursor-pointer hover:bg-white/5 group border-white/5">
                            <span className="text-2xl md:text-3xl font-serif text-emerald-100 mb-1 group-hover:scale-110 transition-transform">{stats.manifestedWishes}</span>
                            <span className="text-[10px] md:text-xs text-emerald-500/70 uppercase tracking-widest flex items-center gap-1">已显化 Manifested</span>
                        </Card>

                        <Card onClick={() => setDetailsModal('blocks')} className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-red-900/10 to-transparent cursor-pointer hover:bg-white/5 group border-white/5">
                            <span className="text-2xl md:text-3xl font-serif text-red-100 mb-1 group-hover:scale-110 transition-transform">{stats.uniqueBlocks.length}</span>
                            <span className="text-[10px] md:text-xs text-red-500/70 uppercase tracking-widest flex items-center gap-1">清理信念 Cleared</span>
                        </Card>
                        
                        <Card onClick={() => setDetailsModal('traits')} className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-indigo-900/10 to-transparent cursor-pointer hover:bg-white/5 group border-white/5">
                            <span className="text-2xl md:text-3xl font-serif text-indigo-100 mb-1 group-hover:scale-110 transition-transform">{stats.uniqueTraits.length}</span>
                            <span className="text-[10px] md:text-xs text-indigo-400/70 uppercase tracking-widest flex items-center gap-1">高我特质 Traits</span>
                        </Card>
                    </div>

                    {/* AI Weekly Report */}
                    <Card className="relative overflow-hidden border-lucid-glow/20 bg-white/[0.03]">
                         <div className="flex justify-between items-start mb-6 border-b border-white/5 pb-4">
                             <div className="flex flex-col">
                                 <div className="flex items-center gap-2">
                                     <Zap className="w-5 h-5 text-lucid-glow" />
                                     <h3 className="text-lg font-serif text-white">LUCID 能量报告</h3>
                                 </div>
                                 <p className="text-[10px] text-stone-500 mt-2 font-sans flex items-center gap-1">
                                     <Clock className="w-3 h-3" /> 每周日 20:00 自动生成
                                 </p>
                             </div>
                             {aiReport && (
                                 <span className="text-[10px] text-stone-500 uppercase tracking-widest border border-stone-800 px-2 py-1 rounded bg-black/20">
                                     Weekly Insight
                                 </span>
                             )}
                         </div>
                         
                         {!aiReport ? (
                             <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                 <p className="text-stone-400 text-sm">持续记录日记，系统将自动为您生成深度能量周报。</p>
                                 <Button onClick={handleGenerateReport} disabled={reportLoading} variant="glass" className="rounded-full px-8 text-sm">
                                    {reportLoading ? <LoadingSpinner/> : '立即手动生成'}
                                 </Button>
                             </div>
                         ) : (
                             <div className="space-y-6">
                                <div className="px-2">
                                    <SimpleMarkdown content={aiReport} />
                                </div>
                                <div className="flex justify-center pt-4 border-t border-white/5 mt-4">
                                    <Button onClick={handleGenerateReport} disabled={reportLoading} variant="ghost" className="text-xs text-lucid-dim hover:text-white">
                                        <RefreshCw className={`w-3 h-3 mr-2 ${reportLoading ? 'animate-spin' : ''}`} /> 重新生成报告
                                    </Button>
                                </div>
                             </div>
                         )}
                    </Card>

                    {/* DATA VISUALIZATION GRID */}
                    <div className="grid md:grid-cols-2 gap-6">
                        
                        {/* 1. Emotion Frequency */}
                        <Card onClick={() => setDetailsModal('stat_emotions')} className="flex flex-col h-full hover:bg-white/[0.03] transition-colors cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2 group-hover:text-lucid-glow transition-colors">
                                    <Smile className="w-4 h-4 text-lucid-glow" /> 情绪频次 (Top 20)
                                </h4>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <StatPieChart 
                                    data={stats.topEmotions.map(([name, value]) => ({ 
                                        name: typeof name === 'object' ? JSON.stringify(name) : name, 
                                        value 
                                    }))} 
                                />
                            </div>
                        </Card>

                        {/* 2. Sentiment Flow */}
                        <Card onClick={() => setDetailsModal('emotions')} className="flex flex-col h-full hover:bg-white/[0.03] transition-colors cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2 group-hover:text-lucid-glow transition-colors">
                                    <TrendingUp className="w-4 h-4 text-lucid-glow" /> 情绪流动 (30 Days)
                                </h4>
                            </div>
                            <div className="flex-1 flex items-center justify-center min-h-[160px] pointer-events-none">
                                <SentimentTrendChart 
                                    data={stats.sentimentTrendData}
                                    showXAxis={false}
                                    showGrid={false}
                                    onPointClick={(point) => {
                                        // This click is now handled by the Card's onClick
                                    }}
                                />
                            </div>
                        </Card>

                        {/* 3. Limiting Beliefs */}
                        <Card onClick={() => setDetailsModal('blocks')} className="flex flex-col h-full hover:bg-white/[0.03] transition-colors cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2 group-hover:text-red-400 transition-colors">
                                    <AlertCircle className="w-4 h-4 text-red-400" /> 识别限制性信念 (Top 20)
                                </h4>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <StatPieChart 
                                    data={stats.topBlocks.map(([name, value]) => ({ 
                                        name: typeof name === 'object' ? JSON.stringify(name) : name, 
                                        value 
                                    }))} 
                                    colors={[
                                        '#F28482', // Soft Red
                                        '#F4ACB7', // Muted Pink
                                        '#F7D1CD', // Pale Rose
                                        '#D4A373', // Warm Beige
                                        '#E5989B', // Dusty Rose
                                        '#B5838D', // Old Rose
                                        '#FFB5A7', // Peach
                                        '#F4A261', // Soft Orange
                                        '#E76F51', // Terracotta
                                        '#C05299', // Muted Magenta
                                    ]}
                                />
                            </div>
                        </Card>

                        {/* 4. High Self Traits */}
                        <Card onClick={() => setDetailsModal('traits')} className="flex flex-col h-full hover:bg-white/[0.03] transition-colors cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
                                    <Star className="w-4 h-4 text-indigo-400" /> 收获高我特质 (Top 20)
                                </h4>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <StatPieChart 
                                    data={stats.topTraits.map(([name, value]) => ({ 
                                        name: typeof name === 'object' ? JSON.stringify(name) : name, 
                                        value 
                                    }))}
                                    colors={[
                                        '#A2D2FF', // Baby Blue
                                        '#BDE0FE', // Pale Blue
                                        '#8ECAE6', // Sky Blue
                                        '#219EBC', // Muted Cyan
                                        '#CDB4DB', // Lavender
                                        '#FFAFCC', // Soft Pink
                                        '#6D597A', // Muted Purple
                                        '#457B9D', // Steel Blue
                                        '#0077B6', // Ocean Blue
                                        '#8D99AE', // Blue Grey
                                    ]}
                                />
                            </div>
                        </Card>
                    </div>

                    {/* JOURNAL CALENDAR MODULE */}
                    <Card className="border-stone-800 bg-stone-900/30 h-[500px] flex flex-col overflow-hidden relative">
                         <div className="flex items-center justify-between mb-4 p-6 pb-0 z-10 pointer-events-none">
                             <div className="flex items-center gap-4 pointer-events-auto">
                                 <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                     <CalendarIcon className="w-5 h-5 text-stone-400" />
                                 </div>
                                 <div>
                                     <h4 className="text-sm font-serif text-stone-300">觉察记录 Calendar</h4>
                                     <p className="text-xs text-stone-600 mt-1">Timeline of your journey.</p>
                                 </div>
                             </div>
                         </div>
                         
                         {/* Calendar Component */}
                         <div className="flex-1 w-full min-h-0">
                             <JournalCalendar 
                                 initialDate={selectedDateForCalendar}
                                 journalEntries={journalEntries}
                                 ritualEntries={ritualEntries}
                                 onDeleteJournalEntry={onDeleteJournalEntry}
                                 onDeleteRitual={onDeleteRitual}
                                 className="bg-transparent"
                             />
                         </div>
                    </Card>

                    {/* DATA BACKUP & SAFETY */}
                    <Card className="border-stone-800 bg-stone-900/30">
                         <div className="flex items-start justify-between mb-6">
                             <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                     <ShieldCheck className="w-5 h-5 text-stone-400" />
                                 </div>
                                 <div>
                                     <h4 className="text-sm font-serif text-stone-300">数据安全备份</h4>
                                     <p className="text-xs text-stone-600 mt-1">本地数据存储，请定期备份。</p>
                                 </div>
                             </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                             <Button onClick={handleExportJSON} variant="outline" className="text-xs border-white/10 text-stone-400 hover:text-white justify-center">
                                 <Download className="w-4 h-4 mr-2" /> 导出备份 (JSON)
                             </Button>
                             
                             <Button onClick={handleExportHTML} variant="outline" className="text-xs border-white/10 text-stone-400 hover:text-white hover:border-lucid-glow/30 justify-center">
                                 <FileText className="w-4 h-4 mr-2" /> 导出报告 (HTML)
                             </Button>

                             <Button onClick={handleImportClick} variant="outline" className="text-xs border-white/10 text-stone-400 hover:text-white hover:bg-white/5 justify-center">
                                 <Upload className="w-4 h-4 mr-2" /> 导入数据 (同步)
                             </Button>
                             <input 
                                 type="file" 
                                 ref={fileInputRef} 
                                 onChange={handleFileChange} 
                                 className="hidden" 
                                 accept=".json"
                             />
                         </div>
                    </Card>
                </div>
            )}
            
            {/* 2. TIME CAPSULE (LETTERS) */}
            {tab === 'letters' && (
                <div className="space-y-8 pb-10 pt-4 animate-fade-in">
                    
                    {!showLetterInput && (
                        <div className={`flex justify-center py-8 ${letters.length === 0 ? 'min-h-[50vh] flex-col items-center justify-center space-y-4' : ''}`}>
                            
                            {/* REDESIGNED BUTTON: TIME CAPSULE CARD */}
                            <button
                               onClick={() => setShowLetterInput(true)}
                               className="relative group w-full max-w-sm px-8 py-6 rounded-3xl transition-all duration-700 hover:scale-[1.02] active:scale-95"
                            >
                               {/* Glow Effect */}
                               <div className="absolute -inset-0.5 bg-lucid-glow/30 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500 rounded-3xl"></div>
                               
                               {/* Backgrounds */}
                               <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-950 border border-white/10 opacity-90 backdrop-blur-xl group-hover:border-lucid-glow/30 transition-colors rounded-3xl" />
                               
                               {/* Content */}
                               <div className="relative z-10 flex flex-col items-center gap-3">
                                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-lucid-glow/10 group-hover:border-lucid-glow/30 transition-colors duration-500">
                                     <Mail className="w-5 h-5 text-stone-300 group-hover:text-lucid-glow transition-colors" />
                                  </div>
                                  
                                  <div className="text-center">
                                      <span className="block font-serif text-white tracking-widest text-lg mb-1 group-hover:text-lucid-glow transition-colors">写给未来的自己</span>
                                      <span className="block text-[10px] text-stone-500 uppercase tracking-[0.2em] group-hover:text-stone-400 transition-colors">Time Capsule</span>
                                  </div>
                               </div>
                            </button>

                            {letters.length === 0 && (
                                <p className="text-stone-500 font-serif text-sm">暂无信件，开启第一封时空通信</p>
                            )}
                        </div>
                    )}

                    {showLetterInput && (
                        <div className="max-w-3xl mx-auto animate-fade-in">
                            <Card 
                                ref={cardRef}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                                style={{
                                    '--mouse-x': '0px',
                                    '--mouse-y': '0px',
                                    '--rotate-x': '0deg',
                                    '--rotate-y': '0deg',
                                    transform: letterInput ? 'none' : 'perspective(1000px) rotateX(var(--rotate-x)) rotateY(var(--rotate-y))',
                                    willChange: 'transform',
                                } as React.CSSProperties}
                                className={`border-lucid-glow/20 bg-gradient-to-b from-stone-900/50 to-transparent !p-0 overflow-hidden flex flex-col min-h-[60vh] relative group transition-all duration-200 ease-out ${
                                    !letterInput ? 'hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.05)]' : ''
                                }`}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                                    <div className="flex items-center gap-2 text-lucid-glow">
                                        <Mail className="w-4 h-4" />
                                        <span className="text-xs font-serif tracking-widest">致未来的信 To Future Self</span>
                                    </div>
                                    <button onClick={() => setShowLetterInput(false)} className="text-lucid-dim hover:text-white transition-colors p-1">
                                         <X className="w-4 h-4"/> 
                                    </button>
                                </div>

                                {/* Textarea */}
                                <textarea 
                                    className="flex-1 w-full bg-transparent p-6 md:p-8 text-lg md:text-xl font-serif focus:outline-none text-stone-200 placeholder-stone-700/50 resize-none transition-all leading-loose tracking-wide custom-scrollbar"
                                    placeholder="亲爱的未来自己，希望此刻的你..."
                                    value={letterInput}
                                    onChange={(e) => setLetterInput(e.target.value)}
                                    autoFocus
                                />
                                
                                {/* Footer Controls */}
                                <div className="p-4 border-t border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
                                     <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                                        <Clock className="w-4 h-4 text-lucid-dim" />
                                        <span className="text-xs text-stone-400 font-serif">送达时间:</span>
                                        <select 
                                            value={letterDelay} 
                                            onChange={(e) => setLetterDelay(Number(e.target.value))}
                                            className="bg-transparent text-sm text-lucid-glow focus:outline-none cursor-pointer font-serif"
                                        >
                                            <option value={0} className="bg-stone-800">10秒后 (测试)</option>
                                            <option value={7} className="bg-stone-800">1周后</option>
                                            <option value={30} className="bg-stone-800">1个月后</option>
                                            <option value={180} className="bg-stone-800">6个月后</option>
                                            <option value={365} className="bg-stone-800">1年后</option>
                                        </select>
                                    </div>

                                    <Button onClick={handleSendLetter} disabled={isSending || !letterInput} variant="glass" className="rounded-full px-6 py-2 text-sm border-lucid-glow/20 text-lucid-glow hover:bg-lucid-glow/10">
                                        {isSending ? <LoadingSpinner /> : <span className="flex items-center gap-2">封存信件 <Send className="w-4 h-4" /></span>}
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {letters.length > 0 && !showLetterInput && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {letters.map((letter) => {
                                const isLocked = Date.now() < letter.sendDate;
                                return (
                                    <div 
                                        key={letter.id} 
                                        onClick={() => {
                                            setSelectedLetter(letter);
                                            // Mark as read if unlocked and currently unread
                                            if (!isLocked && !letter.isRead && onUpdateLetter) {
                                                onUpdateLetter({ ...letter, isRead: true });
                                            }
                                        }}
                                        className={`relative group rounded-3xl p-6 border transition-all duration-300 cursor-pointer overflow-hidden ${
                                            !isLocked 
                                            ? 'bg-white/[0.04] border-white/10 hover:border-lucid-glow/30 hover:shadow-lg hover:shadow-lucid-glow/5' 
                                            : 'bg-white/[0.02] border-white/5 opacity-80'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            {!isLocked ? (
                                                <div className="bg-lucid-glow/10 text-lucid-glow px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Unlock className="w-3 h-3" />
                                                    <span className="text-[10px] uppercase tracking-wider font-bold">Unlocked</span>
                                                </div>
                                            ) : (
                                                <div className="bg-stone-800 text-stone-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Lock className="w-3 h-3" />
                                                    <span className="text-[10px] uppercase tracking-wider font-bold">Locked</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-stone-600 font-serif">{new Date(letter.createdAt).toLocaleDateString()}</span>
                                            <div onClick={e => e.stopPropagation()}>
                                                {confirmDeleteLetterId === letter.id ? (
                                                    <div className="flex items-center gap-1 bg-stone-800 rounded-full px-1 py-0.5 border border-rose-500/30 animate-fade-in">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteLetter(letter.id);
                                                                setConfirmDeleteLetterId(null);
                                                                if (selectedLetter?.id === letter.id) setSelectedLetter(null);
                                                            }}
                                                            className="bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 transition-colors"
                                                            title="确认删除"
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDeleteLetterId(null);
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
                                                            setConfirmDeleteLetterId(letter.id);
                                                        }}
                                                        className="text-stone-600 hover:text-rose-400 transition-colors p-1.5 rounded-full hover:bg-rose-500/10"
                                                        title="删除信件"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                        <h4 className="text-white font-serif text-lg mb-2 truncate">To Future Self</h4>
                                        
                                        <div className="text-sm text-stone-400 font-serif line-clamp-3 leading-relaxed">
                                            {letter.aiReply ? (
                                                <span className="text-lucid-glow italic">" {typeof letter.aiReply === 'object' ? (letter.aiReply as any).text : letter.aiReply} "</span>
                                            ) : (
                                                "Waiting for future resonance..."
                                            )}
                                        </div>

                                        {!isLocked && !letter.isRead && (
                                            <div className="absolute top-3 right-3 w-2 h-2 bg-lucid-glow rounded-full animate-pulse"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 3. WISHES LIST */}
            {tab === 'wishes' && (
                <div className="relative w-full">
                    <motion.div 
                        ref={constraintsRef} 
                        className="w-full min-h-[150vh] relative block"
                    >
                        {wishes.length === 0 ? (
                             <div className="flex flex-col items-center justify-center text-stone-500 py-32 space-y-4 w-full absolute top-20 left-0 right-0">
                                <div className="p-6 bg-white/5 rounded-full">
                                    <Archive className="w-8 h-8 opacity-50" />
                                </div>
                                <p className="font-serif text-base">暂无显化记录</p>
                            </div>
                        ) : (
                            wishes.map((wish, index) => (
                                <WishStickyNote 
                                    key={wish.id}
                                    wish={wish}
                                    constraintsRef={constraintsRef}
                                    bringToFront={bringToFront}
                                    setSelectedWish={setSelectedWish}
                                    zIndex={zIndices[wish.id] || 1}
                                    position={wishPositions[wish.id]}
                                    onPositionChange={handleWishPositionChange}
                                />
                            ))
                        )}
                    </motion.div>
                </div>
            )}

            {/* 4. AFFIRMATION LIBRARY */}
            {tab === 'library' && (
                <div className="space-y-6 pt-4 animate-fade-in">
                     <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                         <div className="flex items-center gap-2">
                            <Type className="w-4 h-4 text-lucid-glow" />
                            <h3 className="text-white font-serif text-base">肯定语库 Library</h3>
                         </div>
                         
                         {/* View Mode Toggle */}
                         <div className="bg-white/5 rounded-lg p-1 flex text-xs">
                            <button 
                                onClick={() => setAffirmationViewMode('all')} 
                                className={`px-3 py-1 rounded-md transition-all ${affirmationViewMode === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                            >
                                全部
                            </button>
                            <button 
                                onClick={() => setAffirmationViewMode('single')} 
                                className={`px-3 py-1 rounded-md transition-all ${affirmationViewMode === 'single' ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                            >
                                筛选
                            </button>
                         </div>
                     </div>
                     
                     {affirmationViewMode === 'single' && (
                         <div className="text-xs text-stone-500 mb-2 flex items-center gap-1 bg-white/5 p-2 rounded-lg">
                             <Filter className="w-3 h-3" /> 
                             <span className="opacity-70">筛选对象:</span>
                             <select 
                                 value={selectedWishId}
                                 onChange={(e) => setSelectedWishId(e.target.value)}
                                 className="bg-transparent text-lucid-glow border-none focus:ring-0 text-xs font-serif cursor-pointer outline-none"
                             >
                                 {wishes.map(w => <option key={w.id} value={w.id}>{w.content.slice(0, 15)}...</option>)}
                             </select>
                         </div>
                     )}

                     <div className="space-y-8">
                        {(affirmationViewMode === 'all' ? wishes : [targetWish]).filter(Boolean).map((w) => w && (
                            <div key={w.id} className="animate-fade-in">
                                {affirmationViewMode === 'all' && (
                                    <div className="flex items-center gap-2 mb-3 pl-1 mt-6 first:mt-0">
                                        <div className="w-1 h-3 bg-lucid-glow/50 rounded-full"></div>
                                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest truncate max-w-[80%]">{w.content}</h4>
                                    </div>
                                )}
                                <div className="grid gap-3">
                                    {w.affirmations.map((aff, i) => (
                                        <Card key={`${w.id}-${i}`} className="flex gap-4 items-start group hover:bg-white/5 transition-colors p-4 border-white/5">
                                            <div className="flex-1">
                                                <span className={`text-[9px] uppercase tracking-widest block mb-1.5 font-sans ${
                                                    aff.type === 'conscious' ? 'text-orange-300/80' : aff.type === 'subconscious' ? 'text-rose-300/80' : 'text-emerald-300/80'
                                                }`}>
                                                    {aff.type === 'conscious' ? '显意识 Conscious' : aff.type === 'subconscious' ? '潜意识 Subconscious' : '未来 Future Self'}
                                                </span>
                                                <p className="text-stone-200 font-serif leading-relaxed text-sm">"{aff.text}"</p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {wishes.length === 0 && <p className="text-center text-stone-500 text-sm py-10">暂无数据</p>}
                     </div>
                </div>
            )}

        </div>
      </div>

      {/* MODALS */}
      
      {/* 1. Details Modal (Milestones - Standard Lists) */}
      <Modal 
          isOpen={!!detailsModal && ['wishes', 'journals'].includes(detailsModal)} 
          onClose={() => {
              setDetailsModal(null);
              setSelectedJournalEntry(null);
          }} 
          title={
              detailsModal === 'wishes' ? '所有愿望 All Wishes' :
              detailsModal === 'journals' ? '觉察日记 Journal Entries' : ''
          }
          bodyClassName={detailsModal === 'journals' ? "p-4 md:p-6 flex flex-col" : undefined}
          bodyRef={detailsModal === 'journals' ? modalBodyRef : undefined}
      >
          <div className="space-y-4 h-full flex flex-col">
              {detailsModal === 'wishes' && wishes.map(w => (
                  <div key={w.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-white font-serif">{w.content}</p>
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-stone-500">{new Date(w.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs text-lucid-glow">{w.status}</span>
                      </div>
                  </div>
              ))}
              
              {detailsModal === 'journals' && (
                  selectedJournalEntry ? (
                    <div className="space-y-6 h-full flex flex-col animate-fade-in">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4 shrink-0">
                            <button onClick={() => setSelectedJournalEntry(null)} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors text-stone-400 hover:text-white">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                 <span className="text-sm font-serif text-white block">
                                    {new Date(selectedJournalEntry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                 </span>
                                 <span className="text-xs text-stone-500 font-sans">
                                    {new Date(selectedJournalEntry.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                 </span>
                            </div>
                            {onDeleteJournalEntry && (
                                <button 
                                    onClick={() => {
                                        if(window.confirm('确定要删除这条日记吗？')) {
                                            onDeleteJournalEntry(selectedJournalEntry.id);
                                            setSelectedJournalEntry(null);
                                        }
                                    }}
                                    className="ml-auto p-2 hover:bg-rose-500/10 rounded-full transition-colors text-stone-500 hover:text-rose-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        
                        <div ref={journalDetailRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            {selectedJournalEntry.aiAnalysis?.emotionalState && (
                                <div className="flex flex-wrap gap-2">
                                    {(Array.isArray(selectedJournalEntry.aiAnalysis.emotionalState) 
                                        ? selectedJournalEntry.aiAnalysis.emotionalState 
                                        : [selectedJournalEntry.aiAnalysis.emotionalState]
                                    ).map((mood: any, idx: number) => {
                                        const moodText = typeof mood === 'object' ? mood.text || mood.title : mood;
                                        return (
                                            <span key={idx} className="text-xs px-3 py-1 rounded-full bg-white/5 text-stone-300 border border-white/10">
                                                {moodText}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="text-stone-200 font-serif leading-loose whitespace-pre-wrap text-base">
                                {selectedJournalEntry.content}
                            </div>

                            {selectedJournalEntry.aiAnalysis?.summary && (
                                 <div className="bg-gradient-to-br from-lucid-glow/5 to-transparent p-5 rounded-2xl border border-lucid-glow/10 relative overflow-hidden">
                                      <div className="flex items-start gap-3 relative z-10">
                                          <Sparkles className="w-5 h-5 text-lucid-glow mt-0.5 flex-shrink-0" />
                                          <div className="space-y-2">
                                              <span className="text-xs font-bold text-lucid-glow uppercase tracking-widest">LUCID Insight</span>
                                              <p className="text-sm text-stone-300 italic leading-relaxed">
                                                  {selectedJournalEntry.aiAnalysis.summary}
                                              </p>
                                          </div>
                                      </div>
                                 </div>
                            )}
                        </div>
                    </div>
                  ) : (
                  <div className="space-y-4 h-full flex flex-col">
                      <div className="relative shrink-0 space-y-2">
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                              <input 
                                 type="text"
                                 placeholder="搜索日记内容、心情..."
                                 value={journalSearch}
                                 onChange={(e) => setJournalSearch(e.target.value)}
                                 className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-200 focus:outline-none focus:border-lucid-glow/30 transition-colors"
                              />
                          </div>
                          
                          {selectedDateForCalendar && (
                              <div className="flex items-center gap-2 animate-fade-in">
                                  <div className="bg-lucid-glow/10 text-lucid-glow border border-lucid-glow/20 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                                      <CalendarIcon className="w-3 h-3" />
                                      <span>筛选日期: {selectedDateForCalendar.toLocaleDateString()}</span>
                                      <button 
                                          onClick={() => setSelectedDateForCalendar(null)} 
                                          className="hover:bg-lucid-glow/20 rounded-full p-0.5 ml-1 transition-colors"
                                      >
                                          <X className="w-3 h-3" />
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>

                      <div ref={journalListRef} className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 -mr-1">
                          {journalEntries
                            .filter(j => {
                                const matchesSearch = !journalSearch || j.content.toLowerCase().includes(journalSearch.toLowerCase()) || (j.aiAnalysis?.emotionalState && String(j.aiAnalysis.emotionalState).toLowerCase().includes(journalSearch.toLowerCase()));
                                const matchesDate = !selectedDateForCalendar || new Date(j.date).toDateString() === selectedDateForCalendar.toDateString();
                                return matchesSearch && matchesDate;
                            })
                            .sort((a, b) => b.date - a.date)
                            .map((entry) => (
                              <div 
                                  key={entry.id} 
                                  onClick={() => {
                                      if (modalBodyRef.current) savedJournalScrollTop.current = modalBodyRef.current.scrollTop;
                                      setSelectedJournalEntry(entry);
                                  }} 
                                  className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl p-5 transition-all duration-300 cursor-pointer"
                              >
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex flex-col">
                                          <span className="text-sm font-serif text-white/90">
                                              {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                                          </span>
                                          <span className="text-xs text-stone-500 font-sans mt-0.5">
                                              {new Date(entry.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                      </div>
                                      
                                      {entry.aiAnalysis?.emotionalState && (
                                          <div className="flex flex-wrap gap-1 justify-end max-w-[40%]">
                                              {(Array.isArray(entry.aiAnalysis.emotionalState) 
                                                  ? entry.aiAnalysis.emotionalState 
                                                  : [entry.aiAnalysis.emotionalState]
                                              ).slice(0, 3).map((mood: any, idx: number) => {
                                                  const moodText = typeof mood === 'object' ? mood.text || mood.title : mood;
                                                  return (
                                                      <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-stone-400 border border-white/5 whitespace-nowrap">
                                                          {moodText}
                                                      </span>
                                                  );
                                              })}
                                          </div>
                                      )}
                                  </div>

                                  <div className="text-stone-300 font-serif leading-relaxed text-sm whitespace-pre-wrap line-clamp-4 transition-all duration-300">
                                      {entry.content}
                                  </div>
                              </div>
                          ))}
                          
                          {journalEntries.length === 0 && (
                             <p className="text-center text-stone-500 py-10">暂无日记记录</p>
                          )}
                          {journalEntries.length > 0 && journalEntries.filter(j => !journalSearch || j.content.toLowerCase().includes(journalSearch.toLowerCase())).length === 0 && (
                             <p className="text-center text-stone-500 py-10">未找到匹配的日记</p>
                          )}
                      </div>
                  </div>
                  )
              )}
          </div>
      </Modal>

      {/* 2. Chart Modals (Emotions, Blocks, Traits) */}
      <SentimentDetailModal
        isOpen={detailsModal === 'emotions'}
        onClose={() => setDetailsModal(null)}
        entries={journalEntries}
        onDateSelect={(date) => {
            setSelectedDateForCalendar(date);
            setDetailsModal('journals');
        }}
      />

      <StatDetailModal
        isOpen={detailsModal === 'blocks'}
        onClose={() => setDetailsModal(null)}
        title="信念清理记录 · Cleared Blocks"
        data={stats.allBlocksList}
        color="#EF4444"
      />

      <StatDetailModal
        isOpen={detailsModal === 'traits'}
        onClose={() => setDetailsModal(null)}
        title="高我特质整合 · Integrated Traits"
        data={stats.allTraitsList}
        color="#818CF8"
      />

      <StatDetailModal
        isOpen={detailsModal === 'stat_emotions'}
        onClose={() => setDetailsModal(null)}
        title="情绪频次分布 · Emotion Frequency"
        data={stats.allEmotionsList}
        color="#FBBF24"
      />

      {/* 3. Wish Detail Modal */}
      {(() => {
          if (!selectedWish) return null;
          const wishStyle = STICKY_STYLES[Math.abs(getStableRandom(selectedWish.id + 'v2')) % STICKY_STYLES.length];
          
          // Force override default modal styles with !important
          const bgOverride = wishStyle.bg.split(' ').map(c => `!${c}`).join(' ');
          const textOverride = wishStyle.text.split(' ').map(c => `!${c}`).join(' ');

          return (
            <Modal 
                isOpen={!!selectedWish} 
                onClose={() => setSelectedWish(null)}
                title="显化蓝图 · Blueprint"
                className={`${bgOverride} ${textOverride} !rounded-sm !border-stone-900/10 !shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)]`}
            >
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.6] to-transparent pointer-events-none mix-blend-soft-light"></div>
                <div className="absolute top-0 left-0 w-full h-[1px] bg-white/60 opacity-50 pointer-events-none"></div>

                {selectedWish && (
                    <div className="space-y-8 pb-10 relative z-10">
                        <div className="flex flex-wrap justify-between items-center border-b border-stone-900/5 pb-4 gap-2">
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-sm text-xs font-sans tracking-wider border ${selectedWish.status === 'active' ? 'bg-stone-900/5 text-stone-600 border-stone-900/10' : 'bg-emerald-800/5 text-emerald-700 border-emerald-800/10'}`}>
                                    {selectedWish.status === 'active' ? '● 进行中 In Progress' : '★ 已显化 Manifested'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 ml-auto">
                                <span className={`text-xs ${wishStyle.metaText} font-serif mr-2`}>{new Date(selectedWish.createdAt).toLocaleString()}</span>
                                <button 
                                    onClick={toggleWishStatus}
                                    className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${selectedWish.status === 'active' ? 'border-stone-900/10 text-stone-600 hover:bg-stone-900/5' : 'border-stone-900/10 text-stone-400 hover:bg-stone-900/5'}`}
                                >
                                   {selectedWish.status === 'active' ? '标记为已实现' : '标记为进行中'}
                                </button>
                                
                                <div className="w-[1px] h-4 bg-stone-900/10 mx-1 hidden md:block"></div>
                                
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteWishClick(selectedWish.id);
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-sm border border-rose-900/10 text-rose-700/70 hover:bg-rose-900/5 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 className="w-3 h-3" /> 删除
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className={`text-2xl font-serif ${wishStyle.text} leading-tight mb-3`}>{selectedWish.content}</h3>
                            <div className="flex items-center gap-2 opacity-70">
                                <div className="w-8 h-[1px] bg-current"></div>
                                <p className="font-serif italic text-base">New Identity: {typeof selectedWish.beliefs.newIdentity === 'object' ? (selectedWish.beliefs.newIdentity as any).name || (selectedWish.beliefs.newIdentity as any).text || JSON.stringify(selectedWish.beliefs.newIdentity) : selectedWish.beliefs.newIdentity}</p>
                            </div>
                        </div>
                        
                        {/* Inner Strengths */}
                        {selectedWish.beliefs.supportiveBeliefs && selectedWish.beliefs.supportiveBeliefs.length > 0 && (
                          <div className="bg-white/40 rounded-sm p-6 border border-stone-900/5 relative overflow-hidden shadow-sm">
                               <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                                  <Zap className="w-24 h-24" />
                              </div>
                              <h4 className={`text-sm ${wishStyle.tagText} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                                  <Zap className="w-4 h-4" /> 现有优势 & 正确思路 Inner Strengths
                              </h4>
                              <div className="grid grid-cols-1 gap-3">
                                  {selectedWish.beliefs.supportiveBeliefs.map((b, i) => (
                                      <div key={i} className="flex items-start gap-3">
                                          <span className={`mt-2 w-1.5 h-1.5 rounded-full ${wishStyle.tagBg.replace('/10', '')} flex-shrink-0 opacity-50`}></span>
                                          <p className={`${wishStyle.text} opacity-80 text-base font-serif leading-relaxed`}>
                                              {typeof b === 'object' ? (b as any).text || String(b) : b}
                                          </p>
                                      </div>
                                  ))}
                              </div>
                          </div>
                        )}

                        {/* Core Shifts */}
                        <div className="bg-stone-900/[0.03] rounded-sm p-6 border border-stone-900/5">
                            <h4 className="text-sm opacity-50 uppercase tracking-widest mb-6">Core Shifts</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <span className="text-xs text-rose-700/60 block mb-3 font-bold tracking-wider">RELEASING BLOCKS</span>
                                    <ul className="space-y-3">
                                        {selectedWish.beliefs.emotionalBlocks.map((b,i) => (
                                            <li key={i} className="flex gap-3 text-sm opacity-70 leading-relaxed font-serif">
                                                <span className="text-rose-400 select-none">-</span>
                                                {typeof b === 'object' ? (b as any).text || String(b) : b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <span className="text-xs text-emerald-700/60 block mb-3 font-bold tracking-wider">IMPRINTING BELIEFS</span>
                                    <ul className="space-y-3">
                                        {selectedWish.beliefs.limitingBeliefs.map((b,i) => (
                                            <li key={i} className="flex gap-3 text-sm opacity-70 leading-relaxed font-serif">
                                                <span className="text-emerald-400 select-none">+</span>
                                                {typeof b === 'object' ? (b as any).text || String(b) : b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Affirmations */}
                        <div className="flex flex-col gap-4">
                             <div className="w-full bg-white/60 rounded-sm border border-stone-900/5 p-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                 <span className="text-[10px] opacity-40 uppercase block mb-4 tracking-[0.2em]">Affirmations ({selectedWish.affirmations.length})</span>
                                 <div className="space-y-4">
                                     {selectedWish.affirmations.map((a,i) => (
                                         <div key={i} className="pl-4 border-l-2 border-stone-900/10 py-1">
                                              <p className="text-lg font-serif leading-relaxed opacity-90 italic">"{a.text}"</p>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                    </div>
                )}
            </Modal>
          );
      })()}

      {/* 3. Time Capsule Detail Modal */}
      <Modal
        isOpen={!!selectedLetter}
        onClose={() => setSelectedLetter(null)}
        title="时间信箱 · Time Capsule"
      >
          {selectedLetter && (
              <div className="space-y-8 pb-4">
                  <div className="bg-gradient-to-br from-lucid-glow/10 to-transparent p-6 rounded-2xl border border-lucid-glow/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Sparkles className="w-24 h-24" />
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-lucid-glow text-lucid-bg flex items-center justify-center">
                              <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                              <span className="text-xs uppercase text-lucid-glow tracking-widest block font-bold">Future Self</span>
                              <span className="text-xs text-lucid-dim">Immediate Resonance</span>
                          </div>
                      </div>
                      <div className="text-white/90 font-serif leading-loose text-base relative z-10 italic">
                          <SimpleMarkdown content={typeof selectedLetter.aiReply === 'object' ? (selectedLetter.aiReply as any).text : selectedLetter.aiReply || ''} />
                      </div>
                  </div>

                  <div className="relative">
                       <div className="flex items-center justify-between mb-4 px-2">
                           <div className="flex items-center gap-2">
                               <div className="w-8 h-8 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center">
                                   <Archive className="w-4 h-4" />
                               </div>
                               <div>
                                   <span className="text-xs uppercase text-stone-400 tracking-widest block font-bold">Your Letter</span>
                                   <span className="text-xs text-stone-600">Written on {new Date(selectedLetter.createdAt).toLocaleDateString()}</span>
                               </div>
                           </div>
                           <div className="relative z-50">
                               {confirmDeleteLetterId === selectedLetter.id ? (
                                   <div className="flex items-center gap-2 bg-stone-800 rounded-full px-2 py-1 border border-rose-500/30 animate-fade-in">
                                       <span className="text-[10px] text-rose-300">Delete?</span>
                                       <button 
                                           onClick={() => {
                                               onDeleteLetter(selectedLetter.id);
                                               setConfirmDeleteLetterId(null);
                                               setSelectedLetter(null);
                                           }}
                                           className="bg-rose-500 text-white p-1 rounded-full hover:bg-rose-600 transition-colors"
                                       >
                                           <Check className="w-3 h-3" />
                                       </button>
                                       <button 
                                           onClick={() => setConfirmDeleteLetterId(null)}
                                           className="bg-stone-700 text-stone-300 p-1 rounded-full hover:bg-stone-600 transition-colors"
                                       >
                                           <X className="w-3 h-3" />
                                       </button>
                                   </div>
                               ) : (
                                   <button 
                                       onClick={() => setConfirmDeleteLetterId(selectedLetter.id)}
                                       className="text-stone-600 hover:text-rose-400 transition-colors p-2 rounded-full hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                                       title="删除信件"
                                   >
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               )}
                           </div>
                       </div>
                       
                       <div className={`p-6 rounded-2xl border min-h-[150px] relative transition-all ${
                           Date.now() < selectedLetter.sendDate 
                           ? 'bg-black/40 border-stone-800/50' 
                           : 'bg-white/5 border-white/10'
                       }`}>
                           {Date.now() < selectedLetter.sendDate ? (
                               <div className="flex flex-col items-center justify-center h-full py-8 space-y-3">
                                   <Lock className="w-8 h-8 text-stone-600" />
                                   <p className="text-stone-500 font-serif text-sm">此信件正在时间长河中旅行...</p>
                                   <span className="text-xs text-stone-700 font-sans tracking-widest border border-stone-800 px-2 py-1 rounded">
                                       解锁日期: {new Date(selectedLetter.sendDate).toLocaleDateString()}
                                   </span>
                                   <div className="absolute inset-0 backdrop-blur-sm rounded-2xl pointer-events-none"></div>
                               </div>
                           ) : (
                               <>
                                   <div className="bg-lucid-glow/10 text-lucid-glow text-xs px-3 py-1.5 rounded-lg inline-flex items-center mb-4 border border-lucid-glow/20">
                                       <Unlock className="w-3 h-3 mr-2" />
                                       <span>来自过去的信件已送达</span>
                                   </div>
                                   <div className="text-stone-300 font-serif leading-loose whitespace-pre-wrap">
                                       <SimpleMarkdown content={typeof selectedLetter.content === 'object' ? (selectedLetter.content as any).text : selectedLetter.content} />
                                   </div>
                               </>
                           )}
                       </div>
                  </div>
              </div>
          )}
      </Modal>
    </div>
  );
};

export default ArchiveView;
