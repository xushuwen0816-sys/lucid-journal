
import React, { useState, useEffect } from 'react';
import { AppView, Wish, IntentState, JournalEntry, RitualArchiveEntry, TarotReading, DailyPractice, FutureLetter } from './types';
import { Feather, Sun, Hourglass, Sparkles, Key, ArrowRight, User, Zap, BookOpen, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';

// Components
import IntentView from './components/IntentView';
import EnergyCheckView from './components/EnergyCheckView';
import JournalView from './components/JournalView';
import ArchiveView from './components/ArchiveView';
import { Button, LoadingSpinner } from './components/Shared';

// Services
import { setAiConfig, hasApiKey, setUserName, checkConnection } from './services/geminiService';

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_api_key') || '' : ''
  );
  const [userNameInput, setUserNameInput] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_user_name') || '' : ''
  );
  
  // Connection Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Default view is now ENERGY Check
  const [currentView, setCurrentView] = useState<AppView>(AppView.ENERGY);
  
  // Controls which tab inside ArchiveView is active. 
  // Used to direct user to 'wishes' tab immediately after creating a wish.
  const [archiveInitialTab, setArchiveInitialTab] = useState<'milestones' | 'letters' | 'wishes' | 'library'>('milestones');

  // --- GLOBAL STATE ---

  // 1. Wishes (Persistent)
  // Grandma-Proof Update: Added robust "Health Check" during initialization
  const [wishes, setWishes] = useState<Wish[]>(() => {
    if (typeof localStorage !== 'undefined') {
        try {
            const saved = localStorage.getItem('lucid_wishes');
            if (saved) {
                let parsed = JSON.parse(saved);
                
                // Safety check: Ensure it's an array
                if (!Array.isArray(parsed)) parsed = [];

                // DATA MIGRATION & HEALTH CHECK
                // We iterate through every loaded wish to ensure it has an ID card.
                const sanitizedWishes = parsed.map((w: any) => ({
                    ...w,
                    // If an old wish is missing an ID, issue a new one immediately.
                    id: w.id || crypto.randomUUID(),
                    // Ensure creation time exists
                    createdAt: w.createdAt || Date.now(),
                    // Ensure status is valid
                    status: w.status || 'active',
                    // Preserve other fields
                    content: w.content || '',
                    tags: w.tags || {},
                    affirmations: w.affirmations || []
                }));

                return sanitizedWishes;
            }
        } catch (e) {
            console.error("Failed to load wishes safely:", e);
            // In case of error, return empty array rather than crashing, 
            // but in a real app we might want to backup the corrupted string first.
            return [];
        }
    }
    return [];
  });
  
  // Persist Wishes with Error Handling (Grandma-proof)
  useEffect(() => {
    try {
        localStorage.setItem('lucid_wishes', JSON.stringify(wishes));
    } catch (e) {
        console.error("Storage failed", e);
        alert("⚠️ 警告：设备存储空间不足，您的愿望可能未成功保存！请清理空间后重试。");
    }
  }, [wishes]);

  const [activeWishId, setActiveWishId] = useState<string | null>(null);
  
  // Check authorization on mount
  useEffect(() => {
    if (hasApiKey()) {
      setIsAuthorized(true);
    }
  }, []);

  const handleStartSystem = () => {
    if (apiKeyInput.trim().length > 10) {
      setAiConfig(apiKeyInput.trim(), userNameInput.trim(), '');
      setIsAuthorized(true);
    }
  };

  const handleTestConnection = async () => {
      if (apiKeyInput.trim().length < 10) return;
      setIsTesting(true);
      setTestResult(null);
      
      setAiConfig(apiKeyInput.trim(), userNameInput.trim(), '');
      
      const success = await checkConnection();
      setTestResult(success ? 'success' : 'error');
      setIsTesting(false);
  };
  
  // 2. Journal Entries (Persistent)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    try {
        const saved = localStorage.getItem('lucid_all_journals');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const handleAddJournalEntry = (entry: JournalEntry) => {
    const updated = [entry, ...journalEntries];
    setJournalEntries(updated);
    localStorage.setItem('lucid_all_journals', JSON.stringify(updated));
  };

  // 3. Ritual Entries (Persistent)
  const [ritualEntries, setRitualEntries] = useState<RitualArchiveEntry[]>(() => {
    try {
        const saved = localStorage.getItem('lucid_ritual_archive');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Handler to merge ritual updates
  const handleSaveRitual = (data: { date: number, reading?: TarotReading, practice?: DailyPractice }) => {
    setRitualEntries(prev => {
        const dateKey = new Date(data.date).toDateString();
        const existingIndex = prev.findIndex(e => new Date(e.date).toDateString() === dateKey);
        
        let updatedEntry: RitualArchiveEntry;
        if (existingIndex >= 0) {
            updatedEntry = {
                ...prev[existingIndex],
                ...data
            };
            const newArr = [...prev];
            newArr[existingIndex] = updatedEntry;
            return newArr;
        } else {
            updatedEntry = {
                id: crypto.randomUUID(),
                date: data.date,
                reading: data.reading,
                practice: data.practice
            };
            return [updatedEntry, ...prev];
        }
    });
  };

  useEffect(() => {
    localStorage.setItem('lucid_ritual_archive', JSON.stringify(ritualEntries));
  }, [ritualEntries]);

  // 4. Future Letters (Persistent)
  const [letters, setLetters] = useState<FutureLetter[]>(() => {
     try {
       return JSON.parse(localStorage.getItem('lucid_future_letters') || '[]');
     } catch { return []; }
  });

  const handleAddLetter = (letter: FutureLetter) => {
    const updated = [letter, ...letters];
    setLetters(updated);
  };

  useEffect(() => {
      localStorage.setItem('lucid_future_letters', JSON.stringify(letters));
  }, [letters]);


  // --- DATA IMPORT HANDLER ---
  const handleImportData = (data: any) => {
      try {
          if (data.data) {
              const { wishes: w, journalEntries: j, ritualEntries: r, letters: l } = data.data;
              
              if (w) setWishes(w);
              if (j) setJournalEntries(j);
              if (r) setRitualEntries(r);
              if (l) setLetters(l);
              
              // Force persistence immediately to be safe
              if (w) localStorage.setItem('lucid_wishes', JSON.stringify(w));
              if (j) localStorage.setItem('lucid_all_journals', JSON.stringify(j));
              if (r) localStorage.setItem('lucid_ritual_archive', JSON.stringify(r));
              if (l) localStorage.setItem('lucid_future_letters', JSON.stringify(l));
              
              alert('数据导入成功！您的时空记录已恢复。\nData imported successfully.');
          } else {
              throw new Error('Invalid data structure');
          }
      } catch (e) {
          console.error(e);
          alert('导入失败：文件格式不正确。\nFailed to import: Invalid file format.');
      }
  };


  // Persistent State for Intent View
  const [intentState, setIntentState] = useState<IntentState>({
    step: 'input',
    wishInput: '',
    messages: [],
    isTyping: false,
    generatedAffirmations: [],
  });

  const handleWishCreated = (wish: Wish) => {
    // 1. Add new wish to top of list (Standard React Pattern, won't overwrite existing)
    setWishes(prev => [wish, ...prev]);
    setActiveWishId(wish.id);
    
    // 2. Set Archive tab to 'wishes' so user sees it immediately
    setArchiveInitialTab('wishes');
    
    // 3. Navigate to Archive
    setTimeout(() => setCurrentView(AppView.ARCHIVE), 0);
  };

  const handleWishUpdate = (updatedWish: Wish) => {
    setWishes(prev => prev.map(w => w.id === updatedWish.id ? updatedWish : w));
  };

  const navItems = [
    { view: AppView.ENERGY, icon: Zap, label: '能量' },
    { view: AppView.JOURNAL, icon: BookOpen, label: '日记' },
    { view: AppView.INTENT, icon: Feather, label: '愿望' },
    { view: AppView.ARCHIVE, icon: Hourglass, label: '时空' },
  ];

  if (!isAuthorized) {
    return (
      <div className="min-h-screen text-lucid-text font-serif bg-lucid-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
         <div className="absolute inset-0 pointer-events-none">
             <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#3F2E26] rounded-full blur-[150px] opacity-30 animate-pulse-slow"></div>
             <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#4C3A35] rounded-full blur-[120px] opacity-20"></div>
         </div>

         <div className="z-10 w-full max-w-md space-y-8 text-center animate-fade-in">
             <div className="flex flex-col items-center gap-4">
                 <div className="w-16 h-16 rounded-full bg-lucid-glow/10 flex items-center justify-center shadow-[0_0_30px_rgba(253,186,116,0.15)] border border-lucid-glow/20">
                    <Sparkles className="w-8 h-8 text-lucid-glow" />
                 </div>
                 <h1 className="text-3xl font-serif text-white tracking-widest">LUCID · 澄</h1>
                 <p className="text-lucid-dim font-sans text-sm tracking-widest uppercase">潜意识操作系统</p>
             </div>

             <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl space-y-6 text-left">
                 
                 <div className="space-y-2">
                     <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center gap-2">
                         <User className="w-3 h-3" /> 您的名字 Your Name
                     </label>
                     <input 
                        type="text"
                        value={userNameInput}
                        onChange={(e) => setUserNameInput(e.target.value)}
                        placeholder="请输入您的名字或昵称"
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lucid-glow/50 transition-all font-sans text-sm tracking-wide"
                     />
                 </div>

                 <div className="space-y-2">
                     <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center gap-2">
                         <Key className="w-3 h-3" /> API 密钥 (Gemini Key)
                     </label>
                     <input 
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="在此粘贴 AIzaSy... 开头的密钥"
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lucid-glow/50 transition-all font-sans text-sm tracking-wide"
                     />
                     <p className="text-[10px] text-stone-500 pt-1 pl-1">
                        * 在中国大陆使用时，请确保已开启 VPN 等网络工具。
                     </p>
                 </div>

                 <div className="flex justify-end mt-2">
                     <button 
                        onClick={handleTestConnection}
                        disabled={isTesting || apiKeyInput.length < 10}
                        className="text-[10px] flex items-center gap-1 bg-white/5 px-2 py-1 rounded hover:bg-white/10 text-stone-400 hover:text-white transition-colors disabled:opacity-50"
                     >
                        {isTesting ? <LoadingSpinner /> : <Wifi className="w-3 h-3" />}
                        {isTesting ? '连接中...' : '测试连通性'}
                     </button>
                 </div>

                 {testResult === 'success' && (
                     <div className="text-[10px] text-emerald-400 flex items-center gap-1 animate-fade-in mt-2 justify-center bg-emerald-500/10 py-1 rounded">
                         <CheckCircle className="w-3 h-3" /> 连接成功！信号满格，可以启动。
                     </div>
                 )}
                 {testResult === 'error' && (
                     <div className="text-[10px] text-rose-400 flex items-center gap-1 animate-fade-in mt-2 justify-center bg-rose-500/10 py-1 rounded">
                         <AlertTriangle className="w-3 h-3" /> 连接失败。请检查网络或密钥。
                     </div>
                 )}
                 
                 <Button 
                    onClick={handleStartSystem} 
                    disabled={apiKeyInput.length < 10}
                    variant="primary" 
                    className="w-full rounded-xl py-4 text-sm tracking-widest shadow-lg shadow-lucid-glow/20"
                 >
                    启动 LUCID 系统 <ArrowRight className="w-4 h-4 ml-2" />
                 </Button>
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-lucid-text font-serif selection:bg-lucid-glow/30 selection:text-white overflow-hidden relative bg-lucid-bg">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-[#3F2E26] rounded-full blur-[120px] opacity-40 animate-pulse-slow"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#4C3A35] rounded-full blur-[100px] opacity-30 animate-float" style={{ animationDuration: '25s' }}></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-lucid-glow/5 rounded-full blur-[150px]"></div>
      </div>

      <main className="relative z-10 h-screen flex flex-col md:flex-row">
        
        <nav className="order-2 md:order-1 w-full md:w-28 flex md:flex-col items-center md:items-center justify-between md:justify-start py-4 md:py-8 z-50 transition-all duration-300 md:border-r border-white/5 bg-white/[0.01] backdrop-blur-md flex-shrink-0">
           
           <div 
             className="hidden md:flex flex-col items-center mb-10 opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
             onClick={() => setIsAuthorized(false)}
             title="点击修改设置"
           >
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-lucid-glow/20 to-transparent flex items-center justify-center mb-3">
                 <Sparkles className="w-5 h-5 text-lucid-glow" />
             </div>
             <span className="text-xs font-serif tracking-[0.3em] font-light text-white">LUCID</span>
           </div>
           
           <div 
             className="md:hidden flex items-center gap-2 ml-6 cursor-pointer"
             onClick={() => setIsAuthorized(false)}
             title="点击修改设置"
           >
             <Sparkles className="w-5 h-5 text-lucid-glow" />
             <span className="text-sm font-serif tracking-[0.2em] text-white">LUCID</span>
           </div>

           <div className="flex md:flex-col gap-3 md:gap-3 mr-9 md:mr-0 md:mt-16">
             {navItems.map((item) => (
               <button
                 key={item.view}
                 onClick={() => {
                     setCurrentView(item.view);
                     // If user clicks Archive manually, generally default to Milestones or keep current?
                     // Let's reset to milestones to be safe unless we are in deep navigation.
                     if (item.view === AppView.ARCHIVE) setArchiveInitialTab('milestones');
                 }}
                 className={`group flex flex-col items-center gap-1.5 relative transition-all duration-500 outline-none p-1 md:p-2 rounded-xl ${
                   currentView === item.view ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                 }`}
               >
                 <div className={`p-3 md:p-3.5 rounded-2xl transition-all duration-500 ease-out ${currentView === item.view ? 'bg-lucid-glow text-lucid-bg scale-100 shadow-[0_0_20px_rgba(253,186,116,0.3)]' : 'bg-white/5 text-white scale-90'}`}>
                   <item.icon className={`w-5 h-5 stroke-[1.5px]`} />
                 </div>
                 <span className="text-sm tracking-[0.1em] font-sans hidden md:block">{item.label}</span>
               </button>
             ))}
           </div>
        </nav>

        <div className="order-1 md:order-2 flex-1 relative overflow-hidden flex flex-col">
           <div className="flex-1 w-full h-full p-2 md:p-6 max-w-6xl mx-auto flex flex-col">
              {currentView === AppView.INTENT && (
                <IntentView state={intentState} setState={setIntentState} onComplete={handleWishCreated} />
              )}
              
              {currentView === AppView.ENERGY && (
                <EnergyCheckView 
                    wishes={wishes} 
                    onSaveRitual={handleSaveRitual}
                />
              )}
              
              {currentView === AppView.JOURNAL && (
                <JournalView 
                    onAddJournalEntry={handleAddJournalEntry}
                />
              )}
              
              {currentView === AppView.ARCHIVE && (
                <ArchiveView 
                    wishes={wishes} 
                    journalEntries={journalEntries} 
                    ritualEntries={ritualEntries}
                    letters={letters}
                    onUpdateWish={handleWishUpdate}
                    onAddLetter={handleAddLetter}
                    onImportData={handleImportData}
                    initialTab={archiveInitialTab}
                />
              )}
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;
