
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Wish, FutureLetter, JournalEntry, RitualArchiveEntry } from '../types';
import { SectionTitle, Card, Button, LoadingSpinner, TabNav, Modal, SimpleMarkdown } from './Shared';
import { Archive, Mail, Clock, Send, Star, Lock, Unlock, Zap, ArrowRight, Sparkles, RefreshCw, Calendar as CalendarIcon, ChevronRight, ChevronLeft, CreditCard, Sun, Type, Filter, TrendingUp, AlertCircle, Smile, X, Download, ShieldCheck, FileText, Upload, Trash2, Check } from 'lucide-react';
import { generateFutureLetterReply, generateWeeklyReport } from '../services/geminiService';

interface ArchiveViewProps {
  wishes: Wish[];
  journalEntries: JournalEntry[];
  ritualEntries: RitualArchiveEntry[];
  letters: FutureLetter[];
  onUpdateWish: (wish: Wish) => void;
  onAddLetter: (letter: FutureLetter) => void;
  onImportData: (data: any) => void;
  onDeleteJournalEntry?: (id: string) => void;
  initialTab?: 'milestones' | 'letters' | 'wishes' | 'library';
}

type DetailsType = 'wishes' | 'journals' | 'blocks' | 'traits' | 'emotions' | null;

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

// Helper: Get Heatmap Color Class based on emotions
const getMoodStyle = (emotions: string[] = []): string => {
    if (!emotions || emotions.length === 0) return 'bg-white/[0.05] border-white/10 text-stone-400';

    const e = emotions.join(' ').toLowerCase();
    
    // 1. High Energy / Joy (Orange/Amber)
    if (e.match(/joy|happy|excited|confident|proud|喜悦|快乐|兴奋|自信|自豪|inspired|灵感/)) {
        return 'bg-orange-500/30 border-orange-500/40 text-orange-100 shadow-[0_0_10px_rgba(249,115,22,0.2)]';
    }
    // 2. Love / Gratitude (Rose/Pink)
    if (e.match(/love|grateful|hope|爱|感恩|希望|touch|感动/)) {
        return 'bg-rose-500/30 border-rose-500/40 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
    }
    // 3. Peace / Calm (Emerald/Teal)
    if (e.match(/peace|calm|content|relieved|平静|安宁|满足|释然|safe|安全/)) {
        return 'bg-emerald-500/30 border-emerald-500/40 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
    }
    // 4. Low Energy / Sadness (Indigo/Blue)
    if (e.match(/sad|lonely|tired|bored|hopeless|悲伤|孤独|疲惫|无聊|绝望|depress/)) {
        return 'bg-indigo-500/30 border-indigo-500/40 text-indigo-200';
    }
    // 5. Intense Negative / Anger (Red/Stone)
    if (e.match(/angry|frustrated|anxious|fear|guilty|愤怒|挫败|焦虑|恐惧|内疚|压力/)) {
        return 'bg-stone-700/80 border-rose-500/30 text-rose-200';
    }

    // Default active but unknown emotion
    return 'bg-stone-700 border-white/20 text-stone-200';
};

// Helper: Sort map by value desc
const sortAndSlice = (map: Record<string, number>, limit: number = 10) => {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
};

const ArchiveView: React.FC<ArchiveViewProps> = ({ wishes, journalEntries, ritualEntries, letters, onUpdateWish, onAddLetter, onImportData, onDeleteJournalEntry, initialTab = 'milestones' }) => {
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
  
  // --- Letters State ---
  const [letterInput, setLetterInput] = useState('');
  const [letterDelay, setLetterDelay] = useState<number>(30); // days
  const [isSending, setIsSending] = useState(false);
  const [showLetterInput, setShowLetterInput] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<FutureLetter | null>(null);

  // --- Derived Stats for Milestones ---
  const stats = useMemo(() => {
     const totalEntries = journalEntries.length;
     const manifestedWishes = wishes.filter(w => w.status === 'manifested').length;
     
     const emotionCounts: Record<string, number> = {};
     const blockCounts: Record<string, number> = {};
     const traitCounts: Record<string, number> = {};
     
     const allBlocksRaw: { text: string, date: number }[] = [];
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
                        allBlocksRaw.push({ text: cleanB, date: entry.date });
                        blockCounts[cleanB] = (blockCounts[cleanB] || 0) + 1;
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
                         allTraitsRaw.push({ text: cleanT, date: entry.date });
                         traitCounts[cleanT] = (traitCounts[cleanT] || 0) + 1;
                     }
                 });
             }
         }
     });

     const uniqueBlocks = Object.keys(blockCounts);
     const uniqueTraits = Object.keys(traitCounts);
     
     const topEmotions = sortAndSlice(emotionCounts, 10);
     const topBlocks = sortAndSlice(blockCounts, 10);
     const topTraits = sortAndSlice(traitCounts, 10);

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
         sentimentData,
         emotionCountsTotal: Object.values(emotionCounts).reduce((a,b)=>a+b,0),
         blocksCountsTotal: Object.values(blockCounts).reduce((a,b)=>a+b,0),
         traitsCountsTotal: Object.values(traitCounts).reduce((a,b)=>a+b,0),
     };
  }, [journalEntries, wishes]);

  // Check for unlocked letters
  const hasUnlockedLetters = useMemo(() => {
      return letters.some(l => !l.isLocked && Date.now() >= l.sendDate && (l as any).read !== true);
  }, [letters]);

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

  <h2>🔮 灵感塔罗 (Tarot Readings)</h2>
  ${ritualEntries.filter(r => r.reading).length > 0 ? ritualEntries.filter(r => r.reading).map(r => `
    <div class="card">
      <div class="card-header">
        <span class="date">${new Date(r.date).toLocaleString()}</span>
      </div>
      <div class="tarot-cards">
         ${r.reading?.cards.map(c => `
            <div class="tarot-card">
               ${c.position}: ${c.name} (${c.isReversed ? '逆' : '正'})
            </div>
         `).join('')}
      </div>
      <div class="journal-content" style="font-style: italic; color: #FDBA74;">
         " ${r.reading?.guidance} "
      </div>
    </div>
  `).join('') : '<p style="text-align:center; color:#555;">暂无塔罗记录</p>'}

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
    const actualUnlockTime = letterDelay === 0 ? Date.now() + 10000 : unlockTime;

    const reply = await generateFutureLetterReply(letterInput);
    
    const newLetter: FutureLetter = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      content: letterInput,
      sendDate: actualUnlockTime,
      aiReply: reply,
      isLocked: true 
    };

    onAddLetter(newLetter);
    
    setLetterInput('');
    setIsSending(false);
    setShowLetterInput(false);
  };

  const toggleWishStatus = () => {
      if (!selectedWish) return;
      const newStatus = selectedWish.status === 'active' ? 'manifested' : 'active';
      const updatedWish = { ...selectedWish, status: newStatus as any };
      onUpdateWish(updatedWish);
      setSelectedWish(updatedWish); 
  };

  const getWishPhase = (wish: Wish) => {
      if (wish.status === 'manifested') return { name: '已显化', color: 'text-emerald-400', border: 'border-emerald-500/30' };
      if (Object.keys(wish.beliefs || {}).length > 0) return { name: '校准 · Align', color: 'text-blue-400', border: 'border-blue-500/30' };
      return { name: '意图 · Intent', color: 'text-stone-400', border: 'border-stone-500/30' };
  };

  // --- Sub-components ---
  
  const JournalCalendar = () => {
      const [selectedEntry, setSelectedEntry] = useState<{ journals: JournalEntry[], ritual?: RitualArchiveEntry, dateStr: string } | null>(null);
      const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

      // Map entries to days string key "YYYY-MM-DD"
      // CHANGED: Support array of journals for each day
      const entriesByDay = useMemo(() => {
          const map: Record<string, { journals: JournalEntry[], ritual?: RitualArchiveEntry }> = {};
          
          journalEntries.forEach(e => {
              const d = new Date(e.date).toDateString();
              if (!map[d]) {
                  map[d] = { journals: [], ritual: undefined };
              }
              map[d].journals.push(e);
          });
          
          // Ensure journals are sorted (newest first for display, or oldest first for timeline)
          // Let's do newest first
          Object.keys(map).forEach(key => {
              map[key].journals.sort((a,b) => b.date - a.date);
          });

          ritualEntries.forEach(r => {
              const d = new Date(r.date).toDateString();
              if (!map[d]) {
                  map[d] = { journals: [], ritual: undefined };
              }
              // Merge ritual if exists (assuming one per day, or latest overwrite)
              map[d] = { ...map[d], ritual: r };
          });
          return map;
      }, [journalEntries, ritualEntries]);

      // Determine range of months to display
      // Default to last 12 months if no data, otherwise from first entry to today
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
          // Ensure at least one month
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

                      {/* Journals Section (Now supports list) */}
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
                                                      <span key={i} className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-stone-300">
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
                                                          <span key={`block-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300 font-serif">
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
                                              // Aggregate all emotions from all entries
                                              const allEmotions = entry.journals.flatMap(j => 
                                                  Array.isArray(j.aiAnalysis?.emotionalState) 
                                                  ? j.aiAnalysis?.emotionalState 
                                                  : (typeof j.aiAnalysis?.emotionalState === 'string' ? [j.aiAnalysis.emotionalState] : [])
                                              ).filter(Boolean) as string[];
                                              
                                              // Ensure flat strings only
                                              const flatEmotions = allEmotions.map(e => typeof e === 'object' ? (e as any).text || '' : e).filter(e => e);
                                              
                                              moodStyle = getMoodStyle(flatEmotions);
                                          } else if (hasRitual) {
                                              moodStyle = 'bg-indigo-900/30 border-indigo-500/20 text-indigo-300';
                                          }

                                          // Aggregate title
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
                                                  {/* Show dot if multiple entries */}
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

  const SentimentChart = () => {
      const data = stats.sentimentData;
      if (data.length < 2) return <p className="text-xs text-stone-500 italic text-center py-4">需要更多日记数据来生成曲线</p>;

      const height = 100;
      const width = 300; // viewBox width
      const maxScore = 10;
      const minScore = 1;
      
      const points = data.map((d, i) => {
          const x = (i / (data.length - 1)) * width;
          const y = height - ((d.score - minScore) / (maxScore - minScore)) * height;
          return `${x},${y}`;
      }).join(' ');

      return (
          <div className="w-full h-40 relative group">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                  <line x1="0" y1="0" x2={width} y2="0" stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                  <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                  <line x1="0" y1={height} x2={width} y2={height} stroke="white" strokeOpacity="0.05" strokeDasharray="4 4" />
                  <polyline
                      fill="none"
                      stroke="#FDBA74"
                      strokeWidth="2"
                      points={points}
                      vectorEffect="non-scaling-stroke"
                      className="drop-shadow-[0_0_10px_rgba(253,186,116,0.3)]"
                  />
                  {data.map((d, i) => {
                       const x = (i / (data.length - 1)) * width;
                       const y = height - ((d.score - minScore) / (maxScore - minScore)) * height;
                       return (
                           <circle 
                            key={i} 
                            cx={x} 
                            cy={y} 
                            r="3" 
                            fill="#1C1917" 
                            stroke="#FDBA74" 
                            strokeWidth="2"
                            className="hover:scale-150 transition-transform cursor-pointer"
                           >
                               <title>{new Date(d.date).toLocaleDateString()}: {d.emotions.join(', ')}</title>
                           </circle>
                       )
                  })}
              </svg>
          </div>
      );
  };

  const RankingList = ({ items, colorClass, barColor, emptyText }: { items: [string, number][], colorClass: string, barColor: string, emptyText: string }) => {
      if (items.length === 0) return <p className="text-stone-500 text-xs italic py-4 text-center">{emptyText}</p>;
      const max = items[0][1];
      return (
          <div className="space-y-3">
              {items.map(([name, count], i) => (
                  <div key={i} className="flex items-center gap-3">
                      <div className="w-8 text-[10px] text-stone-500 text-right font-sans">#{i+1}</div>
                      <div className="flex-1">
                          <div className="flex justify-between items-end mb-1">
                              <span className={`text-xs font-serif ${colorClass}`}>
                                  {typeof name === 'object' ? JSON.stringify(name) : name}
                              </span>
                              <span className="text-[9px] text-stone-600">{count}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${barColor} opacity-50`} 
                                style={{ width: `${(count / max) * 100}%` }}
                              ></div>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <SectionTitle title="我的时空" subtitle="ARCHIVE · 个人状态" />

      <TabNav 
        activeTab={tab}
        onTabChange={setTab}
        tabs={[
            { id: 'milestones', icon: Zap, label: '生命洞察' },
            { id: 'letters', icon: Clock, label: '时间胶囊', badge: hasUnlockedLetters },
            { id: 'wishes', icon: Star, label: '显化列表' },
            { id: 'library', icon: Type, label: '能量语库' },
        ]}
      />

      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar animate-fade-in pb-20">
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

                        <Card onClick={() => setDetailsModal('blocks')} className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-rose-900/10 to-transparent cursor-pointer hover:bg-white/5 group border-white/5">
                            <span className="text-2xl md:text-3xl font-serif text-rose-100 mb-1 group-hover:scale-110 transition-transform">{stats.uniqueBlocks.length}</span>
                            <span className="text-[10px] md:text-xs text-rose-500/70 uppercase tracking-widest flex items-center gap-1">清理信念 Cleared</span>
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
                        <Card className="flex flex-col h-full hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2">
                                    <Smile className="w-4 h-4 text-lucid-glow" /> 情绪频次 (Top 10)
                                </h4>
                            </div>
                            <RankingList 
                                items={stats.topEmotions} 
                                colorClass="text-stone-200" 
                                barColor="bg-lucid-glow"
                                emptyText="记录日记以分析情绪模式..."
                            />
                        </Card>

                        {/* 2. Sentiment Flow */}
                        <Card className="flex flex-col h-full hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-lucid-glow" /> 情绪流动 (Flow)
                                </h4>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <SentimentChart />
                            </div>
                        </Card>

                        {/* 3. Limiting Beliefs */}
                        <Card className="flex flex-col h-full hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-400" /> 识别限制性信念 (Top 10)
                                </h4>
                            </div>
                            <RankingList 
                                items={stats.topBlocks} 
                                colorClass="text-rose-200" 
                                barColor="bg-rose-500"
                                emptyText="持续觉察以发现潜意识阻碍..."
                            />
                        </Card>

                        {/* 4. High Self Traits */}
                        <Card className="flex flex-col h-full hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-sm font-serif text-lucid-dim uppercase tracking-widest flex items-center gap-2">
                                    <Star className="w-4 h-4 text-indigo-400" /> 收获高我特质 (Top 10)
                                </h4>
                            </div>
                            
                             {stats.topTraits.length === 0 ? (
                                <p className="text-stone-500 text-xs italic py-4 text-center">记录日记以发现你的闪光点...</p>
                             ) : (
                                <div className="flex flex-wrap gap-2 content-start">
                                    {stats.topTraits.map(([name, count], i) => (
                                        <div key={i} className="flex items-center bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1.5 group cursor-default">
                                            <span className="text-xs text-indigo-200 font-serif mr-2">
                                                {typeof name === 'object' ? JSON.stringify(name) : name}
                                            </span>
                                            <span className="text-[10px] text-indigo-400/60 bg-indigo-500/10 px-1.5 rounded-full">{count}</span>
                                        </div>
                                    ))}
                                </div>
                             )}
                        </Card>
                    </div>

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
                               className="relative group w-full max-w-sm px-8 py-6 rounded-3xl overflow-hidden transition-all duration-700 hover:scale-[1.02] active:scale-95"
                            >
                               {/* Backgrounds */}
                               <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-950 border border-white/10 opacity-90 backdrop-blur-xl group-hover:border-lucid-glow/30 transition-colors" />
                               <div className="absolute -inset-1 bg-gradient-to-r from-lucid-glow/0 via-lucid-glow/10 to-lucid-glow/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-1000" />
                               
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
                            <Card className="border-lucid-glow/20 bg-gradient-to-b from-stone-900/50 to-transparent !p-0 overflow-hidden flex flex-col min-h-[60vh] relative">
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
                                        onClick={() => setSelectedLetter(letter)}
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
                                            <span className="text-xs text-stone-600 font-serif">{new Date(letter.createdAt).toLocaleDateString()}</span>
                                        </div>

                                        <h4 className="text-white font-serif text-lg mb-2 truncate">To Future Self</h4>
                                        
                                        <div className="text-sm text-stone-400 font-serif line-clamp-3 leading-relaxed">
                                            {letter.aiReply ? (
                                                <span className="text-lucid-glow italic">" {typeof letter.aiReply === 'object' ? (letter.aiReply as any).text : letter.aiReply} "</span>
                                            ) : (
                                                "Waiting for future resonance..."
                                            )}
                                        </div>

                                        {!isLocked && (
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
                <div className="space-y-6 pt-4 animate-fade-in">
                    {wishes.length === 0 ? (
                         <div className="flex flex-col items-center justify-center text-stone-500 py-32 space-y-4">
                            <div className="p-6 bg-white/5 rounded-full">
                                <Archive className="w-8 h-8 opacity-50" />
                            </div>
                            <p className="font-serif text-base">暂无显化记录</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                            {wishes.map(wish => {
                                const phase = getWishPhase(wish);
                                const days = Math.floor((Date.now() - wish.createdAt) / (1000 * 60 * 60 * 24));
                                return (
                                    <div 
                                        key={wish.id}
                                        onClick={() => setSelectedWish(wish)}
                                        className={`group relative bg-white/[0.02] hover:bg-white/[0.05] border ${phase.border} rounded-3xl p-6 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-lucid-glow/5`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-black/20 ${phase.color}`}>
                                                {phase.name}
                                            </span>
                                            <span className="text-xs text-lucid-dim font-serif">Started {days}d ago</span>
                                        </div>
                                        
                                        <h3 className="text-lg font-serif text-white mb-2 line-clamp-2 leading-relaxed group-hover:text-lucid-glow transition-colors">
                                            {wish.content}
                                        </h3>
                                        
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {wish.tags?.emotional?.slice(0, 3).map((tag, i) => (
                                                <span key={i} className="text-xs text-stone-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                    #{typeof tag === 'object' ? 'Tag' : tag}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRight className="w-5 h-5 text-lucid-glow" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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
      
      {/* 1. Details Modal (Milestones) */}
      <Modal isOpen={!!detailsModal} onClose={() => setDetailsModal(null)} title={
          detailsModal === 'wishes' ? '所有愿望 All Wishes' :
          detailsModal === 'journals' ? '觉察记录 Calendar' :
          detailsModal === 'blocks' ? '清理信念 Cleared Blocks' :
          detailsModal === 'traits' ? '高我特质 High Self Traits' : ''
      }>
          <div className="space-y-4">
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
                  <JournalCalendar />
              )}

              {detailsModal === 'blocks' && (
                  stats.allBlocksRaw.length > 0 ? stats.allBlocksRaw.map((b, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-rose-500/5 rounded-lg border border-rose-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                        <div className="flex-1">
                            <span className="text-stone-200 font-serif text-sm">{b.text}</span>
                            <span className="text-[10px] text-stone-500 block">{new Date(b.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                  )) : <p className="text-stone-500 text-center py-4">暂无数据</p>
              )}

              {detailsModal === 'traits' && (
                  stats.allTraitsRaw.length > 0 ? stats.allTraitsRaw.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <div className="flex-1">
                            <span className="text-stone-200 font-serif text-sm">{t.text}</span>
                            <span className="text-[10px] text-stone-500 block">{new Date(t.date).toLocaleDateString()}</span>
                        </div>
                    </div>
                  )) : <p className="text-stone-500 text-center py-4">暂无数据</p>
              )}
          </div>
      </Modal>

      {/* 2. Wish Detail Modal */}
      <Modal 
         isOpen={!!selectedWish} 
         onClose={() => setSelectedWish(null)}
         title="显化蓝图 · Blueprint"
      >
          {selectedWish && (
              <div className="space-y-8 pb-10">
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-sans tracking-wider border ${selectedWish.status === 'active' ? 'bg-lucid-glow/10 text-lucid-glow border-lucid-glow/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                              {selectedWish.status === 'active' ? '● 进行中 In Progress' : '★ 已显化 Manifested'}
                          </span>
                      </div>
                      <div className="flex items-center gap-3">
                          <span className="text-xs text-stone-500 font-serif mr-2">{new Date(selectedWish.createdAt).toLocaleString()}</span>
                          <button 
                              onClick={toggleWishStatus}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selectedWish.status === 'active' ? 'border-green-500/30 text-green-400 hover:bg-green-500/10' : 'border-stone-500/30 text-stone-400 hover:bg-white/5'}`}
                          >
                             {selectedWish.status === 'active' ? '标记为已实现' : '标记为进行中'}
                          </button>
                      </div>
                  </div>

                  <div>
                      <h3 className="text-2xl font-serif text-white leading-relaxed mb-2">{selectedWish.content}</h3>
                      <p className="text-lucid-dim font-serif italic">新身份: {typeof selectedWish.beliefs.newIdentity === 'object' ? (selectedWish.beliefs.newIdentity as any).name || (selectedWish.beliefs.newIdentity as any).text || JSON.stringify(selectedWish.beliefs.newIdentity) : selectedWish.beliefs.newIdentity}</p>
                  </div>
                  
                  {/* NEW: Supportive Beliefs (Inner Strengths) Section */}
                  {selectedWish.beliefs.supportiveBeliefs && selectedWish.beliefs.supportiveBeliefs.length > 0 && (
                    <div className="bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10 relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Zap className="w-24 h-24" />
                        </div>
                        <h4 className="text-sm text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> 现有优势 & 正确思路 Inner Strengths
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            {selectedWish.beliefs.supportiveBeliefs.map((b, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0"></span>
                                    <p className="text-indigo-100/80 text-sm font-serif leading-relaxed">
                                        {typeof b === 'object' ? (b as any).text || String(b) : b}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                  )}

                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                      <h4 className="text-sm text-stone-400 uppercase tracking-widest mb-4">Core Shifts</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <span className="text-xs text-rose-300 block mb-2">已释放阻碍</span>
                              <ul className="list-disc list-inside text-stone-400 text-sm space-y-1">
                                  {selectedWish.beliefs.emotionalBlocks.map((b,i) => <li key={i}>{typeof b === 'object' ? (b as any).text || String(b) : b}</li>)}
                              </ul>
                          </div>
                          <div>
                              <span className="text-xs text-emerald-300 block mb-2">需要重塑的信念</span>
                              <ul className="list-disc list-inside text-stone-400 text-sm space-y-1">
                                  {selectedWish.beliefs.limitingBeliefs.map((b,i) => <li key={i}>{typeof b === 'object' ? (b as any).text || String(b) : b}</li>)}
                              </ul>
                          </div>
                      </div>
                  </div>

                  <div className="flex flex-col gap-4">
                       <div className="w-full bg-white/5 rounded-xl border border-white/5 p-4 overflow-y-auto max-h-[300px] custom-scrollbar">
                           <span className="text-[10px] text-stone-500 uppercase block mb-3">Affirmations ({selectedWish.affirmations.length})</span>
                           <div className="space-y-2">
                               {selectedWish.affirmations.map((a,i) => (
                                   <div key={i} className="pl-3 border-l-2 border-white/10 py-1">
                                        <p className="text-xs md:text-sm text-stone-200 font-serif leading-relaxed">{a.text}</p>
                                   </div>
                               ))}
                           </div>
                       </div>
                  </div>
              </div>
          )}
      </Modal>

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
                       <div className="flex items-center gap-2 mb-4 px-2">
                           <div className="w-8 h-8 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center">
                               <Archive className="w-4 h-4" />
                           </div>
                           <div>
                               <span className="text-xs uppercase text-stone-400 tracking-widest block font-bold">Your Letter</span>
                               <span className="text-xs text-stone-600">Written on {new Date(selectedLetter.createdAt).toLocaleDateString()}</span>
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
