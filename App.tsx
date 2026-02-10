
import React, { useState, useEffect, useRef } from 'react';
import { AppView, Wish, IntentState, JournalEntry, RitualArchiveEntry, TarotReading, DailyPractice, FutureLetter } from './types';
import { Feather, Sun, Moon, Hourglass, Sparkles, Key, ArrowRight, User, Zap, BookOpen, Wifi, AlertTriangle, CheckCircle, Globe, Link as LinkIcon, ToggleLeft, ToggleRight, Server, Settings, LogOut, ChevronUp, ChevronDown } from 'lucide-react';

// Components
import VariableProximity from './components/VariableProximity';
import IntentView from './components/IntentView';
import EnergyCheckView from './components/EnergyCheckView';
import JournalView from './components/JournalView';
import ArchiveView from './components/ArchiveView';
import { Button, LoadingSpinner } from './components/Shared';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { AuthPage } from './components/AuthPage';

// Services
import { setAiConfig, hasApiKey, checkConnection } from './services/geminiService';

const DEFAULT_PROXY = import.meta.env.VITE_DEFAULT_PROXY_URL || '';
const DEFAULT_API_KEY = import.meta.env.VITE_DEFAULT_API_KEY || '';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, token, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  
  // Provider Selection: 'gemini' only now
  // const provider = 'gemini';

  // Separate Key Storage - Only Gemini
  const [geminiKey, setGeminiKey] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_key_gemini') || localStorage.getItem('lucid_api_key') || '' : ''
  );

  // Active Input State
  const [apiKeyInput, setApiKeyInput] = useState(() => {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_key_gemini') || localStorage.getItem('lucid_api_key') || '' : '';
  });
  
  const [userNameInput, setUserNameInput] = useState(() => 
    typeof localStorage !== 'undefined' ? localStorage.getItem('lucid_user_name') || '' : ''
  );

  // Handle Input Changes with Persistence
  const handleKeyChange = (val: string) => {
      setApiKeyInput(val);
      // Only persist to localStorage if it's NOT the default key
      // This prevents the default key from being written to user's storage
      if (val !== DEFAULT_API_KEY) {
          setGeminiKey(val);
          localStorage.setItem('lucid_key_gemini', val);
          localStorage.setItem('lucid_api_key', val);
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

  const { isLightMode, toggleTheme } = useTheme();

  const [intentState, setIntentState] = useState<IntentState>({
    step: 'input',
    wishInput: '',
    messages: [],
    isTyping: false,
    generatedAffirmations: []
  });

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const proxyParam = params.get('proxy');
      if (proxyParam) {
          setUseProxy(true);
      }
  }, []);

  // Scroll to top on view change
  useEffect(() => {
      window.scrollTo(0, 0);
  }, [currentView]);

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
      
      // 1. Sync Journals
      fetch(`${baseUrl}/api/journals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch journals: ${res.status}`);
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
      .catch(console.warn);

      // 2. Sync Rituals
      fetch(`${baseUrl}/api/rituals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch rituals: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
            setRitualEntries(data.map((r: any) => ({
                ...r,
                date: typeof r.date === 'string' ? new Date(r.date).getTime() : r.date
            })));
        }
      })
      .catch(console.warn);

      // 3. Sync Wishes
      fetch(`${baseUrl}/api/wishes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch wishes: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
            setWishes(data.map((w: any) => ({
                ...w,
                createdAt: typeof w.createdAt === 'string' ? new Date(w.createdAt).getTime() : w.createdAt,
                // Ensure JSON fields are parsed (though server sends them parsed, double check type safety)
                tags: typeof w.tags === 'string' ? JSON.parse(w.tags) : w.tags,
                beliefs: typeof w.beliefs === 'string' ? JSON.parse(w.beliefs) : w.beliefs,
                affirmations: typeof w.affirmations === 'string' ? JSON.parse(w.affirmations) : w.affirmations
            })));
        }
      })
      .catch(console.warn);

      // 4. Sync Letters
      fetch(`${baseUrl}/api/letters`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) {
            if (res.status === 404) return [];
            throw new Error(`Failed to fetch letters: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
            setLetters(data.map((l: any) => ({
                ...l,
                createdAt: typeof l.createdAt === 'string' ? new Date(l.createdAt).getTime() : l.createdAt,
                sendDate: typeof l.sendDate === 'string' ? new Date(l.sendDate).getTime() : l.sendDate
            })));
        }
      })
      .catch(console.warn);

    }
  }, [user, token]);

  const getEffectiveBaseUrl = () => {
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
          setGeminiKey(effectiveKey);
          // Provider is always Gemini now
          
          if (user.proxyUrl) setProxyUrlInput(user.proxyUrl);

          // Auto-authorize if user has a name and valid key (which they should have by default now)
          /* 
          // User requested manual entry only via "Enter System" button
          if (user.name && effectiveKey.length > 5) {
               setAiConfig(effectiveKey, user.name, user.proxyUrl || DEFAULT_PROXY);
               setIsAuthorized(true);
          }
          */
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
                provider: 'gemini'
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
            // Do not await - sync in background to unblock UI
            updateProfile().catch(err => console.error("Background profile sync failed:", err));
        }
        setAiConfig(apiKeyInput.trim(), userNameInput.trim(), getEffectiveBaseUrl());
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
      
      setAiConfig(apiKeyInput.trim(), userNameInput.trim(), getEffectiveBaseUrl());
      
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

    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/journals/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        }).catch(console.error);
    }
  };

  const handleUpdateJournalEntry = (updatedEntry: JournalEntry) => {
    const updated = journalEntries.map(j => j.id === updatedEntry.id ? updatedEntry : j);
    setJournalEntries(updated);
    localStorage.setItem('lucid_all_journals', JSON.stringify(updated));

    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/journals/${updatedEntry.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedEntry)
        }).catch(console.error);
    }
  };

  // 3. Ritual Entries
  const [ritualEntries, setRitualEntries] = useState<RitualArchiveEntry[]>(() => {
    try {
        const saved = localStorage.getItem('lucid_ritual_archive');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const handleSaveRitual = (data: { date: number, reading?: TarotReading, oracleReading?: TarotReading, practice?: DailyPractice }) => {
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
            
            // Sync to server (Update)
            if (user && token) {
                const baseUrl = import.meta.env.VITE_API_URL || '';
                fetch(`${baseUrl}/api/rituals`, {
                    method: 'POST', // We used Upsert logic on server
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedEntry)
                }).catch(console.error);
            }
            
            return newArr;
        } else {
            updatedEntry = {
                id: crypto.randomUUID(),
                date: data.date,
                reading: data.reading,
                oracleReading: data.oracleReading,
                practice: data.practice
            };
            
            // Sync to server (Create)
            if (user && token) {
                const baseUrl = import.meta.env.VITE_API_URL || '';
                fetch(`${baseUrl}/api/rituals`, {
                    method: 'POST', // We used Upsert logic on server
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedEntry)
                }).catch(console.error);
            }
            
            return [updatedEntry, ...prev];
        }
    });
  };

  useEffect(() => {
    localStorage.setItem('lucid_ritual_archive', JSON.stringify(ritualEntries));
  }, [ritualEntries]);

  const handleDeleteRitual = (id: string) => {
    setRitualEntries(prev => prev.filter(r => r.id !== id));
    
    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/rituals/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        }).catch(console.error);
    }
  };

  // 4. Future Letters
  const [letters, setLetters] = useState<FutureLetter[]>(() => {
     try {
       return JSON.parse(localStorage.getItem('lucid_future_letters') || '[]');
     } catch { return []; }
  });

  const handleAddLetter = (letter: FutureLetter) => {
    const updated = [letter, ...letters];
    setLetters(updated);

    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/letters`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(letter)
        }).catch(console.error);
    }
  };

  const handleDeleteLetter = (id: string) => {
    const updated = letters.filter(l => l.id !== id);
    setLetters(updated);
    
    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/letters/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        }).catch(console.error);
    }
  };

  const handleUpdateLetter = (updatedLetter: FutureLetter) => {
    const updated = letters.map(l => l.id === updatedLetter.id ? updatedLetter : l);
    setLetters(updated);

    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/letters`, {
            method: 'POST', // Using POST for upsert/update
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedLetter)
        }).catch(console.error);
    }
  };

  useEffect(() => {
      localStorage.setItem('lucid_future_letters', JSON.stringify(letters));
  }, [letters]);

  const handleImportData = (data: any) => {
      try {
          if (data.data) {
              const { wishes: w, journalEntries: j, ritualEntries: r, letters: l } = data.data;
              
              if (Array.isArray(w)) setWishes(w);
              if (Array.isArray(j)) setJournalEntries(j);
              if (Array.isArray(r)) setRitualEntries(r);
              if (Array.isArray(l)) setLetters(l);
              
              alert("Data imported successfully!");
          }
      } catch (e) {
          console.error("Import failed", e);
          alert("Failed to import data.");
      }
  };

  const handleWishCreated = (wish: Wish) => {
      const updated = [wish, ...wishes];
      setWishes(updated);
      
      if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/wishes`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(wish)
        }).catch(console.error);
      }
      
      setCurrentView(AppView.ENERGY);
  };

  const handleWishUpdate = (updatedWish: Wish) => {
    setWishes(prev => prev.map(w => w.id === updatedWish.id ? updatedWish : w));
    
    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/wishes/${updatedWish.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedWish)
        }).catch(console.error);
    }
  };

  const handleDeleteWish = (id: string) => {
    setWishes(prev => prev.filter(w => w.id !== id));
    if (activeWishId === id) setActiveWishId(null);

    if (user && token) {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        fetch(`${baseUrl}/api/wishes/${id}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`
            }
        }).catch(console.error);
    }
  };

  const navItems = [
    { view: AppView.ENERGY, icon: Zap, label: '能量' },
    { view: AppView.JOURNAL, icon: BookOpen, label: '日记' },
    { view: AppView.INTENT, icon: Feather, label: '愿望' },
    { view: AppView.ARCHIVE, icon: Hourglass, label: '时空' },
  ];

  if (!isAuthorized) {
    // Only show launch screen if no user is logged in
    // If isAuthorized is false but user exists, it means we are in "Settings" mode (AuthPage)
    // NOTE: When user is logged in (user != null), we still want to show AuthPage if isAuthorized is false.
    // This allows "Logout" button to just unset isAuthorized but keep user state until fully logged out.
    // However, the request is "Stay on AuthPage after logout".
    // Logout function clears the user. So user will be null.
    // If user is null and isAuthorized is false, we usually show Launch Screen.
    // But if we want to stay on AuthPage, we need to know we are in "Auth Mode".
    // We can use isAuthModalOpen for this.
    
    if (!isAuthModalOpen && !user) {
      return (
        <div className={`min-h-screen font-serif flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-500 ${isLightMode ? 'bg-[#FFFAF5] text-stone-800' : 'bg-gradient-to-br from-[#3c2a20] via-[#2a201c] to-[#1a1614] text-lucid-text'}`}>
           <div className="absolute inset-0 pointer-events-none">
               <div className={`absolute top-[-10%] left-[-10%] w-[30%] h-[30%] rounded-full blur-[100px] animate-pulse-slow ${isLightMode ? 'bg-orange-200/30' : 'bg-orange-800/30'}`}></div>
               <div className={`absolute bottom-[-10%] right-[-10%] w-[25%] h-[25%] rounded-full blur-[80px] ${isLightMode ? 'bg-orange-100/40' : 'bg-orange-700/30'}`}></div>
           </div>

           <div className="z-10 w-full max-w-2xl space-y-12 text-center animate-fade-in -mt-12">
               <div className="flex flex-row items-center justify-center gap-3 opacity-80">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(253,186,116,0.15)] border ${isLightMode ? 'bg-white border-orange-200' : 'bg-lucid-glow/10 border-lucid-glow/20'}`}>
                      <Sparkles className={`w-4 h-4 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} />
                   </div>
                   <h1 className={`text-xl font-serif tracking-widest ${isLightMode ? 'text-stone-800' : 'text-white'}`}>LUCID · 澄</h1>
               </div>

               <div ref={containerRef} className="py-2 space-y-4 pb-4" style={{ fontFamily: "'Source Serif 4', serif" }}>
                   <h2 className={`text-4xl md:text-5xl italic leading-[1.35] drop-shadow-sm py-1 cursor-default ${isLightMode ? 'text-stone-800' : 'text-[#fffbf0]'}`}>
                       <VariableProximity
                           label="Write It, See It."
                           className="block"
                           fromFontVariationSettings="'wght' 400, 'opsz' 9"
                           toFontVariationSettings="'wght' 900, 'opsz' 40"
                           containerRef={containerRef}
                           radius={100}
                           falloff="linear"
                       />
                       <VariableProximity
                           label="Make Your Reality."
                           className="block"
                           fromFontVariationSettings="'wght' 400, 'opsz' 9"
                           toFontVariationSettings="'wght' 900, 'opsz' 40"
                           containerRef={containerRef}
                           radius={100}
                           falloff="linear"
                       />
                   </h2>
                   <p className={`text-xs md:text-sm max-w-md mx-auto leading-relaxed tracking-wide font-light font-serif ${isLightMode ? 'text-stone-500' : 'text-stone-400/80'}`}>
                       Capture your energy and reflections in Lucid Journal <br />
                       and keep your inner peace alive.
                   </p>
               </div>

               <div className="w-full max-w-[280px] mx-auto flex flex-col gap-3">
                     <Button 
                        onClick={() => {
                            setAuthModalMode('login');
                            setIsAuthModalOpen(true);
                        }}
                        variant="primary" 
                        className={`w-full !rounded-full !py-2.5 border border-transparent text-sm tracking-widest shadow-lg ${isLightMode ? 'shadow-orange-200/50 !bg-none bg-orange-500 hover:bg-orange-600 text-white' : 'shadow-lucid-glow/20'}`}
                     >
                        登录 Login
                     </Button>
                     
                     <button 
                       onClick={() => {
                            setAuthModalMode('register');
                            setIsAuthModalOpen(true);
                       }}
                       className={`w-full py-2.5 rounded-full border text-sm tracking-widest font-serif font-medium relative z-50 cursor-pointer shadow-lg flex items-center justify-center transition-all ${isLightMode ? 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50 shadow-orange-100' : 'border-orange-400/30 bg-gradient-to-r from-orange-400/10 to-rose-400/10 hover:from-orange-400/20 hover:to-rose-400/20 text-orange-100 hover:text-white shadow-orange-900/10'}`}
                     >
                       注册 Register
                     </button>
                   </div>
           </div>
           
           <button
             onClick={() => toggleTheme()}
             className={`absolute top-6 right-6 p-3 rounded-full transition-all duration-300 z-50 ${isLightMode ? 'bg-white/50 hover:bg-white text-stone-600' : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'}`}
           >
             {isLightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
           </button>
        </div>
      );
    }

    return (
      <AuthPage 
        initialView={authModalMode}
        onBack={() => {
            if (user) {
                setIsAuthorized(true);
            } else {
                setIsAuthModalOpen(false);
            }
        }}
        onStartSystem={handleStartSystem}
        userName={userNameInput}
        setUserName={setUserNameInput}
        apiKey={apiKeyInput}
        setApiKey={handleKeyChange}
        useProxy={useProxy}
        setUseProxy={setUseProxy}
        proxyUrl={proxyUrlInput}
        setProxyUrl={setProxyUrlInput}
        isTesting={isTesting}
        testResult={testResult}
        errorMessage={errorMessage}
        onTestConnection={handleTestConnection}
      />
    );
  }

  return (
    <div className={`min-h-screen font-serif selection:bg-lucid-glow/30 selection:text-white overflow-hidden relative transition-colors duration-500 ${isLightMode ? 'bg-[#F2EFE9] text-stone-800' : 'text-lucid-text bg-gradient-to-br from-[#3c2a20] via-[#2a201c] to-[#1a1614]'}`}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
         <div className={`absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full blur-[150px] transition-colors duration-500 ${isLightMode ? 'bg-orange-200/40' : 'bg-orange-800/30'}`}></div>
         <div className={`absolute bottom-[-20%] right-[-20%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-500 ${isLightMode ? 'bg-orange-100/40' : 'bg-orange-700/30'}`}></div>
      </div>

      <main className="relative z-10 h-screen flex flex-col md:flex-row">
        
        <nav className={`order-2 md:order-1 w-full md:w-24 flex md:flex-col items-center md:items-center justify-between md:justify-start py-4 md:py-8 z-50 transition-all duration-300 md:border-r flex-shrink-0 ${isLightMode ? 'border-stone-200 bg-white/50 backdrop-blur-md' : 'border-white/5 bg-white/[0.01] backdrop-blur-md'}`}>
           
           <div 
             className="hidden md:flex flex-col items-center mb-10 opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
             onClick={() => {
                 setIsAuthorized(false);
                 setIsAuthModalOpen(true);
             }}
             title="点击修改设置"
           >
             <div className={`w-10 h-10 rounded-full bg-gradient-to-tr flex items-center justify-center mb-3 ${isLightMode ? 'from-orange-500/20 to-transparent' : 'from-lucid-glow/20 to-transparent'}`}>
                 <Sparkles className={`w-5 h-5 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} />
             </div>
             <span className={`text-xs font-serif tracking-[0.3em] font-light ${isLightMode ? 'text-stone-600' : 'text-white'}`}>LUCID</span>
           </div>
           
           <div 
             className="md:hidden flex items-center gap-2 ml-6 cursor-pointer"
             onClick={() => {
                 setIsAuthorized(false);
                 setIsAuthModalOpen(true);
             }}
             title="点击修改设置"
           >
             <Sparkles className={`w-5 h-5 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} />
             <span className={`text-sm font-serif tracking-[0.2em] ${isLightMode ? 'text-stone-600' : 'text-white'}`}>LUCID</span>
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
                <div className={`p-3 md:p-3.5 rounded-2xl transition-all duration-500 ease-out ${currentView === item.view ? (isLightMode ? 'bg-orange-500 text-white scale-100 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-lucid-glow text-lucid-bg scale-100 shadow-[0_0_20px_rgba(253,186,116,0.3)]') : isLightMode ? 'bg-stone-200 text-stone-500 scale-90' : 'bg-white/5 text-white scale-90'}`}>
                  <item.icon className={`w-5 h-5 stroke-[1.5px]`} />
                </div>
                <span className={`text-sm tracking-[0.1em] font-sans hidden md:block ${isLightMode ? 'text-stone-600' : 'text-stone-400'}`}>{item.label}</span>
              </button>
             ))}
           </div>

           <div className="mt-auto mb-6 hidden md:flex flex-col items-center gap-4 w-full">
             {/* Sidebar login removed */}
           </div>
        </nav>

        <div className="order-1 md:order-2 flex-1 relative overflow-hidden flex flex-col">
           <div className="flex-1 w-full h-full p-2 md:p-6 max-w-6xl mx-auto flex flex-col">
              {currentView === AppView.INTENT && (
                <div className={`${isLightMode ? 'text-stone-800' : 'text-lucid-text'} h-full`}>
                    <IntentView state={intentState} setState={setIntentState} onComplete={handleWishCreated} />
                </div>
              )}
              
              {currentView === AppView.ENERGY && (
                <div className={`${isLightMode ? 'text-stone-800' : 'text-lucid-text'} h-full`}>
                    <EnergyCheckView 
                        wishes={wishes} 
                        onSaveRitual={handleSaveRitual}
                    />
                </div>
              )}
              
              {currentView === AppView.JOURNAL && (
                <div className={`${isLightMode ? 'text-stone-800' : 'text-lucid-text'} h-full`}>
                    <JournalView 
                        onAddJournalEntry={handleAddJournalEntry}
                        onAddLetter={handleAddLetter}
                    />
                </div>
              )}
              
              {currentView === AppView.ARCHIVE && (
                <div className={`${isLightMode ? 'text-stone-800' : 'text-lucid-text'} h-full`}>
                    <ArchiveView 
                        wishes={wishes} 
                        journalEntries={journalEntries} 
                        ritualEntries={ritualEntries}
                        letters={letters}
                        onUpdateWish={handleWishUpdate}
                        onDeleteWish={handleDeleteWish}
                        onAddLetter={handleAddLetter}
                        onDeleteLetter={handleDeleteLetter}
                        onDeleteRitual={handleDeleteRitual}
                        onImportData={handleImportData}
                        onDeleteJournalEntry={handleDeleteJournalEntry}
                        onUpdateJournalEntry={handleUpdateJournalEntry}
                        initialTab={archiveInitialTab}
                        onUpdateLetter={handleUpdateLetter}
                    />
                </div>
              )}
           </div>
        </div>
      </main>
    </div>
  );
};

export default App;
