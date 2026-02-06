
import React, { useState, useEffect } from 'react';
import { AppView, Wish, IntentState, JournalEntry, RitualArchiveEntry, TarotReading, DailyPractice, FutureLetter } from './types';
import { Feather, Sun, Hourglass, Sparkles, Key, ArrowRight, User, Zap, BookOpen, Wifi, AlertTriangle, CheckCircle, Globe, Link as LinkIcon, ToggleLeft, ToggleRight, Server, Settings, LogOut, ChevronUp, ChevronDown } from 'lucide-react';

// Components
import IntentView from './components/IntentView';
import EnergyCheckView from './components/EnergyCheckView';
import JournalView from './components/JournalView';
import ArchiveView from './components/ArchiveView';
import { Button, LoadingSpinner } from './components/Shared';
import { useAuth } from './contexts/AuthContext';
import { AuthModal } from './components/AuthModal';

// Services
import { setAiConfig, hasApiKey, checkConnection } from './services/geminiService';

const DEFAULT_PROXY = import.meta.env.VITE_DEFAULT_PROXY_URL || '';
const DEFAULT_API_KEY = import.meta.env.VITE_DEFAULT_API_KEY || '';

const App: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  
  // Provider Selection: 'gemini' or 'siliconflow'
  const [provider, setProvider] = useState<'gemini' | 'siliconflow'>(() => {
    if (typeof localStorage !== 'undefined') {
       return (localStorage.getItem('lucid_provider') as 'gemini' | 'siliconflow') || 'gemini';
    }
    return 'gemini';
  });

  // Separate Key Storage
  const [geminiKey, setGeminiKey] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_key_gemini') || localStorage.getItem('lucid_api_key') || '' : ''
  );
  
  const [siliconflowKey, setSiliconflowKey] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_key_siliconflow') || '' : ''
  );

  // Active Input State (Initialized based on current provider)
  const [apiKeyInput, setApiKeyInput] = useState(() => {
      const p = typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_provider') || 'gemini' : 'gemini';
      if (p === 'siliconflow') {
          return typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_key_siliconflow') || '' : '';
      }
      return typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_key_gemini') || localStorage.getItem('lucid_api_key') || '' : '';
  });
  
  const [userNameInput, setUserNameInput] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_user_name') || '' : ''
  );

  // Sync Input when Provider Changes
  useEffect(() => {
      if (provider === 'gemini') {
          setApiKeyInput(geminiKey);
      } else {
          setApiKeyInput(siliconflowKey);
      }
  }, [provider]);

  // Handle Input Changes with Persistence
  const handleKeyChange = (val: string) => {
      setApiKeyInput(val);
      // Only persist to localStorage if it's NOT the default key
      // This prevents the default key from being written to user's storage
      if (val !== DEFAULT_API_KEY) {
          if (provider === 'gemini') {
              setGeminiKey(val);
              localStorage.setItem('lucid_key_gemini', val);
              localStorage.setItem('lucid_api_key', val);
          } else {
              setSiliconflowKey(val);
              localStorage.setItem('lucid_key_siliconflow', val);
          }
      }
  };

  // Proxy Toggle
  const [useProxy, setUseProxy] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    const stored = localStorage.getItem('lucid_base_url');
    // If stored is explicitly empty string, it means user wants direct connection
    if (stored === '') return false;
    return true;
  });

  // Proxy URL State
  const [proxyUrlInput, setProxyUrlInput] = useState(() => {
      if (typeof localStorage === 'undefined') return DEFAULT_PROXY;
      const stored = localStorage.getItem('lucid_base_url');
      if (stored && stored !== '') return stored;
      return DEFAULT_PROXY;
  });
  
  // Always force proxy to be true and use the default URL unless specifically overridden
  useEffect(() => {
      setUseProxy(true);
      if (DEFAULT_PROXY && (!proxyUrlInput || proxyUrlInput === DEFAULT_PROXY)) {
          setProxyUrlInput(DEFAULT_PROXY);
      }
  }, []);
  
  // Connection Test State
  const [isTesting, setIsTesting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Default view is now ENERGY Check
  const [currentView, setCurrentView] = useState<AppView>(AppView.ENERGY);
  
  // Controls which tab inside ArchiveView is active. 
  const [archiveInitialTab, setArchiveInitialTab] = useState<'milestones' | 'letters' | 'wishes' | 'library'>('milestones');

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const proxyParam = params.get('proxy');
      if (proxyParam) {
          setUseProxy(true);
      }
  }, []);

  // --- GLOBAL STATE ---

  const [wishes, setWishes] = useState<Wish[]>(() => {
    if (typeof localStorage !== 'undefined') {
        try {
            const saved = localStorage.getItem('lucid_wishes');
            if (saved) {
                let parsed = JSON.parse(saved);
                if (!Array.isArray(parsed)) parsed = [];

                const sanitizedWishes = parsed.map((w: any) => ({
                    ...w,
                    id: w.id || crypto.randomUUID(),
                    createdAt: w.createdAt || Date.now(),
                    status: w.status || 'active',
                    content: w.content || '',
                    tags: w.tags || {},
                    affirmations: w.affirmations || []
                }));

                return sanitizedWishes;
            }
        } catch (e) {
            console.error("Failed to load wishes safely:", e);
            return [];
        }
    }
    return [];
  });
  
  useEffect(() => {
    try {
        localStorage.setItem('lucid_wishes', JSON.stringify(wishes));
    } catch (e) {
        console.error("Storage failed", e);
    }
  }, [wishes]);

  const [activeWishId, setActiveWishId] = useState<string | null>(null);
  
  useEffect(() => {
    if (hasApiKey()) {
      setIsAuthorized(true);
    }
  }, []);

  // Sync Data on Login
  useEffect(() => {
    if (user && token) {
      // Use empty string to let Vite proxy handle /api requests
      const baseUrl = import.meta.env.VITE_API_URL || '';
      
      console.log('Syncing journals from:', `${baseUrl}/api/journals`);
      
      fetch(`${baseUrl}/api/journals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
            console.error('Sync failed status:', res.status, res.statusText);
            // Don't throw for 404/401, just handle gracefully
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
            setJournalEntries(data.map((j: any) => ({
                ...j,
                date: typeof j.date === 'string' ? new Date(j.date).getTime() : j.date
            })));
        }
      })
      .catch(err => {
          // Suppress the error if it's just a connection issue during dev
          console.warn("Sync warning (offline or server down):", err.message);
      });
    }
  }, [user, token]);

  const getEffectiveBaseUrl = () => {
    if (provider === 'siliconflow') return '';
    return useProxy ? (proxyUrlInput.trim() || DEFAULT_PROXY) : '';
  };

  // Sync user profile from DB to inputs
  useEffect(() => {
      if (user) {
          if (user.name) setUserNameInput(user.name);
          
          let effectiveKey = user.apiKey;
          if ((!effectiveKey || effectiveKey.length < 5) && DEFAULT_API_KEY) {
              effectiveKey = DEFAULT_API_KEY;
          }

          setApiKeyInput(effectiveKey);
          
          if (user.provider === 'siliconflow') {
              setSiliconflowKey(effectiveKey);
              setProvider('siliconflow');
          } else {
              setGeminiKey(effectiveKey);
              setProvider('gemini');
          }
          
          if (user.proxyUrl) setProxyUrlInput(user.proxyUrl);
          if (user.provider) setProvider(user.provider as any);

          // Auto-authorize if user has a name and valid key (which they should have by default now)
          if (user.name && effectiveKey.length > 5) {
               setAiConfig(effectiveKey, user.name, user.proxyUrl || DEFAULT_PROXY, (user.provider as any) || 'gemini');
               setIsAuthorized(true);
          }
      }
  }, [user]);

  const updateProfile = async () => {
    if (!user || !token) return;
    try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        await fetch(`${baseUrl}/api/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: userNameInput,
                apiKey: apiKeyInput,
                proxyUrl: proxyUrlInput,
                provider: provider
            })
        });
    } catch (e) {
        console.error("Failed to update profile", e);
    }
  };

  const handleStartSystem = async () => {
    if (apiKeyInput.trim().length > 5) {
      setIsStarting(true);
      try {
        if (user) {
            await updateProfile();
        }
        setAiConfig(apiKeyInput.trim(), userNameInput.trim(), getEffectiveBaseUrl(), provider);
        setIsAuthorized(true);
      } finally {
        setIsStarting(false);
      }
    }
  };

  const handleTestConnection = async () => {
      if (apiKeyInput.trim().length < 5) return;
      setIsTesting(true);
      setTestResult(null);
      setErrorMessage("");
      
      setAiConfig(apiKeyInput.trim(), userNameInput.trim(), getEffectiveBaseUrl(), provider);
      
      const result = await checkConnection();
      if (result.success) {
          setTestResult('success');
      } else {
          setTestResult('error');
          setErrorMessage(result.message || "连接失败");
      }
      setIsTesting(false);
  };
  
  // 2. Journal Entries
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    try {
        const saved = localStorage.getItem('lucid_all_journals');
        if (saved) {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed.map((j: any) => ({
                ...j,
                id: j.id || crypto.randomUUID()
            })) : [];
        }
        return [];
    } catch { return []; }
  });

  const handleAddJournalEntry = (entry: JournalEntry) => {
    const updated = [entry, ...journalEntries];
    setJournalEntries(updated);
    localStorage.setItem('lucid_all_journals', JSON.stringify(updated));

    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/journals`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(entry)
        }).catch(console.error);
    }
  };

  const handleDeleteJournalEntry = (id: string) => {
    const updated = journalEntries.filter(j => j.id !== id);
    setJournalEntries(updated);
    localStorage.setItem('lucid_all_journals', JSON.stringify(updated));
  };

  const handleUpdateJournalEntry = (updatedEntry: JournalEntry) => {
    const updated = journalEntries.map(j => j.id === updatedEntry.id ? updatedEntry : j);
    setJournalEntries(updated);
    localStorage.setItem('lucid_all_journals', JSON.stringify(updated));
  };

  // 3. Ritual Entries
  const [ritualEntries, setRitualEntries] = useState<RitualArchiveEntry[]>(() => {
    try {
        const saved = localStorage.getItem('lucid_ritual_archive');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

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

  // 4. Future Letters
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

  const handleImportData = (data: any) => {
      try {
          if (data.data) {
              const { wishes: w, journalEntries: j, ritualEntries: r, letters: l } = data.data;
              
              if (w) setWishes(w);
              if (j) setJournalEntries(j);
              if (r) setRitualEntries(r);
              if (l) setLetters(l);
              
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
    setWishes(prev => [wish, ...prev]);
    setActiveWishId(wish.id);
    setArchiveInitialTab('wishes');
    setTimeout(() => setCurrentView(AppView.ARCHIVE), 0);
  };

  const handleWishUpdate = (updatedWish: Wish) => {
    setWishes(prev => prev.map(w => w.id === updatedWish.id ? updatedWish : w));
  };

  const handleDeleteWish = (id: string) => {
    setWishes(prev => prev.filter(w => w.id !== id));
    if (activeWishId === id) setActiveWishId(null);
  };

  const navItems = [
    { view: AppView.ENERGY, icon: Zap, label: '能量' },
    { view: AppView.JOURNAL, icon: BookOpen, label: '日记' },
    { view: AppView.INTENT, icon: Feather, label: '愿望' },
    { view: AppView.ARCHIVE, icon: Hourglass, label: '时空' },
  ];

  if (!isAuthorized) {
    if (!user) {
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
                   <div className="flex flex-col gap-4">
                     <Button 
                        onClick={() => {
                            setAuthModalMode('login');
                            setIsAuthModalOpen(true);
                        }}
                        variant="primary" 
                        className="w-full rounded-xl py-4 text-sm tracking-widest shadow-lg shadow-lucid-glow/20"
                     >
                        登录 Login
                     </Button>
                     
                     <button 
                       onClick={() => {
                            setAuthModalMode('register');
                            setIsAuthModalOpen(true);
                       }}
                       className="w-full py-3.5 rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-400/10 to-rose-400/10 hover:from-orange-400/20 hover:to-rose-400/20 text-orange-100 hover:text-white transition-all text-sm tracking-widest font-serif font-medium relative z-50 cursor-pointer shadow-lg shadow-orange-900/10"
                     >
                       注册 Register
                     </button>
                   </div>
               </div>
           </div>
           <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} initialView={authModalMode} />
        </div>
      );
    }

    return (
      <div className="min-h-screen text-lucid-text font-serif bg-lucid-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
         <div className="absolute top-4 right-4 z-50">
             <div className="relative">
                 <button 
                     onClick={() => setShowUserMenu(!showUserMenu)}
                     className="text-stone-500 hover:text-white transition-colors text-xs flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-black/20 hover:bg-white/10"
                 >
                     <span>{user.name || user.email.split('@')[0]}</span>
                     {showUserMenu ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                 </button>
                 
                 {showUserMenu && (
                     <div className="absolute top-full right-0 mt-2 w-48 bg-[#1C1917] border border-white/10 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col z-[60]">
                         <button 
                            onClick={() => {
                                setIsAuthorized(false);
                                setShowUserMenu(false);
                            }}
                            className="text-left px-4 py-3 text-xs text-stone-400 hover:text-white hover:bg-white/5 flex items-center gap-2"
                         >
                             <Settings className="w-3 h-3" /> 修改配置
                         </button>
                         <button 
                            onClick={() => {
                                logout();
                                setShowUserMenu(false);
                            }}
                            className="text-left px-4 py-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 border-t border-white/5"
                         >
                             <LogOut className="w-3 h-3" /> 退出登录
                         </button>
                     </div>
                 )}
             </div>
         </div>

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
                 <p className="text-lucid-dim font-sans text-sm tracking-widest uppercase">个人信息配置 Setup Profile</p>
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
                     <button 
                        onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                        className="text-xs text-stone-500 hover:text-stone-300 flex items-center gap-2 transition-colors w-full justify-between"
                     >
                         <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                             <Settings className="w-3 h-3" /> 高级配置 (API Key / 代理)
                         </div>
                         {showAdvancedConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                     </button>
                 </div>

                 {showAdvancedConfig && (
                 <div className="space-y-4 pt-4 animate-fade-in">
                     {/* Provider Selection */}
                     <div className="space-y-3 pt-2 border-t border-white/5">
                         <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center gap-2">
                             <Server className="w-3 h-3" /> 模型服务商 Provider
                         </label>
                         <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 rounded-xl">
                             <button
                                onClick={() => setProvider('gemini')}
                                className={`py-2 px-3 rounded-lg text-xs font-serif transition-all ${provider === 'gemini' ? 'bg-lucid-glow text-black shadow-lg' : 'text-stone-400 hover:text-white'}`}
                             >
                                 Google Gemini
                             </button>
                             <button
                                onClick={() => setProvider('siliconflow')}
                                className={`py-2 px-3 rounded-lg text-xs font-serif transition-all ${provider === 'siliconflow' ? 'bg-indigo-500 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
                             >
                                 硅基流动 (SiliconFlow)
                             </button>
                         </div>
                     </div>

                     <div className="space-y-2">
                         <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <Key className="w-3 h-3" /> API 密钥 ({provider === 'gemini' ? 'Gemini' : 'SiliconFlow'} Key)
                             </div>
                         </label>
                         <input 
                           type="password"
                           value={apiKeyInput === DEFAULT_API_KEY ? '' : apiKeyInput}
                           onChange={(e) => handleKeyChange(e.target.value)}
                           placeholder={
                               apiKeyInput === DEFAULT_API_KEY && DEFAULT_API_KEY.length > 0 
                                   ? "已使用默认配置 (安全隐藏)" 
                                   : (provider === 'gemini' ? "粘贴 AIzaSy... 开头的密钥" : "粘贴 sk-... 开头的 SiliconFlow 密钥")
                           }
                           className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lucid-glow/50 transition-all font-sans text-sm tracking-wide"
                        />
                         <p className="text-[10px] text-stone-500 leading-relaxed">
                             {provider === 'gemini' 
                                ? <span>* 请前往 Google AI Studio <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-lucid-glow hover:underline">申请 Key</a></span>
                                : <span>* 请前往 硅基流动官网 <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">申请 Key</a></span>
                             }
                             <span className="ml-1">密钥将绑定到您的账号。</span>
                         </p>
                     </div>

                     {/* Universal Proxy Toggle - Logic Adjusted for SiliconFlow */}
                     <div 
                        onClick={() => {
                            // Only allow toggling if provider is Gemini
                            if (provider === 'gemini') {
                                setUseProxy(!useProxy);
                            }
                        }}
                        className={`
                            relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group
                            ${provider === 'gemini' && useProxy 
                                ? 'bg-gradient-to-r from-orange-900/20 to-rose-900/20 border-lucid-glow/30' 
                                : 'bg-white/[0.03] border-white/5'
                            }
                            ${provider !== 'gemini' ? 'opacity-60 cursor-default' : 'hover:bg-white/[0.05]'}
                        `}
                     >
                         <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-full ${provider === 'gemini' && useProxy ? 'bg-lucid-glow text-black' : 'bg-white/10 text-stone-400'}`}>
                                 <Globe className="w-4 h-4" />
                             </div>
                             <div className="flex flex-col">
                                 <span className={`text-sm font-serif tracking-wide ${provider === 'gemini' && useProxy ? 'text-white' : 'text-stone-400'}`}>
                                     {provider === 'siliconflow' ? 'SiliconFlow 直连模式 (无需代理)' : (useProxy ? '国内访问加速 / 自定义代理' : '海外直连模式')}
                                 </span>
                             </div>
                         </div>
                         
                         <div>
                             {provider === 'gemini' ? (
                                 useProxy ? (
                                     <ToggleRight className="w-8 h-8 text-lucid-glow transition-all" />
                                 ) : (
                                     <ToggleLeft className="w-8 h-8 text-stone-600 transition-all" />
                                 )
                             ) : (
                                 <div className="w-8 h-8"></div>
                             )}
                         </div>
                     </div>

                     {/* Proxy URL Input (Only visible when Proxy is enabled and provider is Gemini) */}
                     {provider === 'gemini' && useProxy && (
                        <div className="space-y-2 animate-fade-in bg-black/20 p-3 rounded-xl border border-white/5">
                             <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center gap-2">
                                 <LinkIcon className="w-3 h-3" /> 代理地址 Proxy URL
                             </label>
                             <input 
                               type="text"
                               value={proxyUrlInput === DEFAULT_PROXY ? '' : proxyUrlInput}
                               onChange={(e) => setProxyUrlInput(e.target.value)}
                               placeholder={
                                   proxyUrlInput === DEFAULT_PROXY && DEFAULT_PROXY.length > 0
                                       ? "已使用默认配置 (安全隐藏)"
                                       : "例如: https://your-worker.workers.dev"
                               }
                               className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lucid-glow/50 transition-all font-sans text-sm tracking-wide"
                            />
                             <p className="text-[10px] text-stone-500 leading-relaxed">
                                * 建议使用 <a href="https://workers.cloudflare.com/" target="_blank" rel="noreferrer" className="text-lucid-glow hover:underline">Cloudflare Workers</a> 搭建私有代理。
                             </p>
                        </div>
                     )}
                     
                     <div className="flex justify-end mt-2">
                         <button 
                            onClick={handleTestConnection}
                            disabled={isTesting || apiKeyInput.length < 5}
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
                             <AlertTriangle className="w-3 h-3" /> {errorMessage || "连接失败。请检查密钥是否正确。"}
                         </div>
                     )}
                 </div>
                 )}
                 
                 <div className="flex flex-col gap-3">
                   <Button 
                      onClick={handleStartSystem} 
                      disabled={apiKeyInput.length < 5}
                      loading={isStarting}
                      variant="primary" 
                      className="w-full rounded-xl py-4 text-sm tracking-widest shadow-lg shadow-lucid-glow/20"
                   >
                      启动 LUCID 系统 <ArrowRight className="w-4 h-4 ml-2" />
                   </Button>
                   
                   <div className="w-full py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs tracking-wider flex items-center justify-between px-4 relative z-50 hidden">
                     <span className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                       {user.email.split('@')[0]}
                     </span>
                     <button onClick={logout} className="hover:text-white transition-colors cursor-pointer">Sign Out</button>
                   </div>
                 </div>
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
        
        <nav className="order-2 md:order-1 w-full md:w-24 flex md:flex-col items-center md:items-center justify-between md:justify-start py-4 md:py-8 z-50 transition-all duration-300 md:border-r border-white/5 bg-white/[0.01] backdrop-blur-md flex-shrink-0">
           
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

           <div className="mt-auto mb-6 hidden md:flex flex-col items-center gap-4 w-full">
             {/* Sidebar login removed */}
           </div>
        </nav>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

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
                    onDeleteWish={handleDeleteWish}
                    onAddLetter={handleAddLetter}
                    onImportData={handleImportData}
                    onDeleteJournalEntry={handleDeleteJournalEntry}
                    onUpdateJournalEntry={handleUpdateJournalEntry}
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
