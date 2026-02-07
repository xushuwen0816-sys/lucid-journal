import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, Key, Globe, Server, ToggleLeft, ToggleRight, Sparkles, Settings, ArrowRight } from 'lucide-react';
import { Button } from './Shared';

interface UnifiedAuthViewProps {
  initialView?: 'login' | 'register';
  onBack: () => void; // To go back to landing page
  onSuccess: () => void; // Called when auth + config is ready (or just auth)
}

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/auth` : '/api/auth';
const DEFAULT_PROXY = import.meta.env.VITE_DEFAULT_PROXY_URL || '';
const DEFAULT_API_KEY = import.meta.env.VITE_DEFAULT_API_KEY || '';

export const UnifiedAuthView: React.FC<UnifiedAuthViewProps> = ({ initialView = 'login', onBack, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(initialView === 'login');
  const { login, user } = useAuth();

  // --- Auth State ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- Config State ---
  // We initialize from localStorage so it persists even if not logged in yet
  const [provider, setProvider] = useState<'gemini' | 'siliconflow'>(() => {
    return (localStorage.getItem('lucid_provider') as 'gemini' | 'siliconflow') || 'gemini';
  });

  const [geminiKey, setGeminiKey] = useState(() => 
    localStorage.getItem('lucid_key_gemini') || localStorage.getItem('lucid_api_key') || ''
  );
  
  const [siliconflowKey, setSiliconflowKey] = useState(() => 
    localStorage.getItem('lucid_key_siliconflow') || ''
  );

  const [apiKeyInput, setApiKeyInput] = useState(() => {
      const p = localStorage.getItem('lucid_provider') || 'gemini';
      if (p === 'siliconflow') return localStorage.getItem('lucid_key_siliconflow') || '';
      return localStorage.getItem('lucid_key_gemini') || localStorage.getItem('lucid_api_key') || '';
  });
  
  const [proxyUrlInput, setProxyUrlInput] = useState(() => {
      const stored = localStorage.getItem('lucid_base_url');
      if (stored && stored !== '') return stored;
      return DEFAULT_PROXY;
  });

  const [useProxy, setUseProxy] = useState(() => {
    const stored = localStorage.getItem('lucid_base_url');
    if (stored === '') return false;
    return true;
  });

  // Sync Input when Provider Changes
  useEffect(() => {
      if (provider === 'gemini') {
          setApiKeyInput(geminiKey);
      } else {
          setApiKeyInput(siliconflowKey);
      }
      localStorage.setItem('lucid_provider', provider);
  }, [provider]);

  // Handle Input Changes with Persistence
  const handleKeyChange = (val: string) => {
      setApiKeyInput(val);
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

  const handleProxyChange = (val: string) => {
      setProxyUrlInput(val);
      // We don't save to localStorage immediately here, usually wait for "Start" or explicit save?
      // App.tsx logic saves it when "Start System" is clicked or implied.
      // But for better UX, let's save it if the user is typing?
      // Actually, App.tsx saves it in `setAiConfig` calls mostly.
      // We will save to localStorage when the user acts.
      if (useProxy) {
          localStorage.setItem('lucid_base_url', val);
      }
  };
  
  const toggleProxy = () => {
      const newState = !useProxy;
      setUseProxy(newState);
      if (!newState) {
          localStorage.setItem('lucid_base_url', '');
      } else {
          localStorage.setItem('lucid_base_url', proxyUrlInput || DEFAULT_PROXY);
      }
  };

  // --- Handlers ---

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const fullUrl = `${API_URL}${endpoint}`;
      
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: isLogin ? undefined : name }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Server Error: ${res.status}`);
      }

      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      login(data.token, data.user);
      // If successful, we might still want to stay here if the user hasn't set up the API key?
      // Or we assume the user might have set it up in the right panel.
      
      // If we are registering, we just got a token.
      // We should check if we need to sync the profile.
      if (!isLogin && name) {
          // If we registered, we might want to ensure the name is synced or local storage is updated?
          // The backend already has the name.
      }
      
      // We can trigger onSuccess, but maybe we should wait for the user to click "Start" on the right?
      // The user wants a unified page.
      // If I login, I am now "User".
      // I should probably see my name in the "Right" panel automatically filled.
      
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Effect: If user logs in, auto-fill the config side if possible
  useEffect(() => {
      if (user) {
          if (user.name && !name) setName(user.name);
          // If user has saved config in DB, it might be in `user` object if the backend returns it.
          // App.tsx syncs `user` to inputs. We should do the same or rely on App.tsx?
          // If we are in this View, App.tsx is rendering us.
          // If `login` updates the context, App.tsx might unmount us if we are not careful!
          // We need to ensure App.tsx keeps us mounted until we are "Authorized".
      }
  }, [user]);

  return (
    <div className="min-h-screen text-lucid-text font-serif bg-lucid-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
             <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#3F2E26] rounded-full blur-[150px] opacity-30 animate-pulse-slow"></div>
             <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#4C3A35] rounded-full blur-[120px] opacity-20"></div>
        </div>

        <button 
            onClick={onBack}
            className="absolute top-6 left-6 text-stone-500 hover:text-white transition-colors z-50 flex items-center gap-2 text-sm tracking-widest"
        >
            <ArrowRight className="w-4 h-4 rotate-180" /> 返回 Back
        </button>

        <div className="z-10 w-full max-w-5xl animate-fade-in flex flex-col md:flex-row gap-6 md:h-[600px]">
            
            {/* LEFT COLUMN: AUTH */}
            <div className="flex-1 glass-panel rounded-[2rem] p-8 border border-white/10 bg-[#1C1917]/80 shadow-2xl flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500/50 to-rose-400/50"></div>
                
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-serif text-white tracking-wide mb-2">
                        {isLogin ? '欢迎回来' : '开启旅程'}
                    </h2>
                    <p className="text-stone-400 text-xs tracking-widest uppercase">
                        {isLogin ? 'Login to Continue' : 'Create Your Account'}
                    </p>
                </div>

                {authError && (
                    <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span>
                        <span className="break-all">{authError}</span>
                    </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-5 max-w-sm mx-auto w-full">
                    {!isLogin && (
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lucid-glow transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="您的名字 Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-lucid-glow/50 focus:bg-white/10 transition-all font-sans tracking-wide"
                                required={!isLogin}
                            />
                        </div>
                    )}
                    
                    <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lucid-glow transition-colors" size={18} />
                        <input
                            type="email"
                            placeholder="邮箱地址 Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-lucid-glow/50 focus:bg-white/10 transition-all font-sans tracking-wide"
                            required
                        />
                    </div>
                    
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lucid-glow transition-colors" size={18} />
                        <input
                            type="password"
                            placeholder="密码 Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-lucid-glow/50 focus:bg-white/10 transition-all font-sans tracking-wide"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        loading={authLoading}
                        className="w-full !rounded-xl !py-3 shadow-lg shadow-orange-500/20 mt-4"
                    >
                        {isLogin ? '登 录 Login' : '注 册 Register'}
                    </Button>
                </form>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setAuthError('');
                        }}
                        className="text-stone-500 hover:text-white text-xs tracking-wider transition-colors hover:underline"
                    >
                        {isLogin ? "还没有账号？去注册 Create Account" : "已有账号？去登录 Login"}
                    </button>
                </div>
            </div>

            {/* RIGHT COLUMN: CONFIG */}
            <div className="flex-1 glass-panel rounded-[2rem] p-8 border border-white/10 bg-[#1C1917]/60 shadow-2xl flex flex-col relative backdrop-blur-md">
                 <div className="flex items-center gap-3 mb-6 opacity-80">
                    <div className="p-2 rounded-full bg-white/5 border border-white/10">
                        <Settings className="w-4 h-4 text-lucid-glow" />
                    </div>
                    <h3 className="text-lg font-serif text-white tracking-wide">个人配置 Setup</h3>
                 </div>

                 <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
                     {/* Provider Selection */}
                     <div className="space-y-3">
                         <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center gap-2">
                             <Server className="w-3 h-3" /> 模型服务商 Provider
                         </label>
                         <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                             <button
                                onClick={() => setProvider('gemini')}
                                className={`py-2.5 px-3 rounded-lg text-xs font-serif transition-all ${provider === 'gemini' ? 'bg-lucid-glow text-black shadow-lg font-medium' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
                             >
                                 Google Gemini
                             </button>
                             <button
                                onClick={() => setProvider('siliconflow')}
                                className={`py-2.5 px-3 rounded-lg text-xs font-serif transition-all ${provider === 'siliconflow' ? 'bg-indigo-500 text-white shadow-lg font-medium' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
                             >
                                 SiliconFlow
                             </button>
                         </div>
                     </div>

                     {/* API Key */}
                     <div className="space-y-2">
                         <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <Key className="w-3 h-3" /> API 密钥 Key
                             </div>
                         </label>
                         <input 
                           type="password"
                           value={apiKeyInput === DEFAULT_API_KEY ? '' : apiKeyInput}
                           onChange={(e) => handleKeyChange(e.target.value)}
                           placeholder={
                               apiKeyInput === DEFAULT_API_KEY && DEFAULT_API_KEY.length > 0 
                                   ? "已使用默认配置 (安全隐藏)" 
                                   : (provider === 'gemini' ? "粘贴 AIzaSy... 密钥" : "粘贴 sk-... 密钥")
                           }
                           className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lucid-glow/50 transition-all font-sans text-sm tracking-wide placeholder-white/20"
                        />
                         <p className="text-[10px] text-stone-500 leading-relaxed">
                             {provider === 'gemini' 
                                ? <span>* <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-lucid-glow hover:underline">Get Gemini Key</a></span>
                                : <span>* <a href="https://cloud.siliconflow.cn/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Get SiliconFlow Key</a></span>
                             }
                         </p>
                     </div>

                     {/* Proxy */}
                     <div 
                        onClick={() => {
                            if (provider === 'gemini') toggleProxy();
                        }}
                        className={`
                            relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group
                            ${provider === 'gemini' && useProxy 
                                ? 'bg-gradient-to-r from-orange-900/10 to-rose-900/10 border-lucid-glow/30' 
                                : 'bg-white/[0.03] border-white/5'
                            }
                            ${provider !== 'gemini' ? 'opacity-50 cursor-default' : 'hover:bg-white/[0.05]'}
                        `}
                     >
                         <div className="flex items-center gap-3">
                             <div className={`p-2 rounded-full ${provider === 'gemini' && useProxy ? 'bg-lucid-glow text-black' : 'bg-white/10 text-stone-400'}`}>
                                 <Globe className="w-4 h-4" />
                             </div>
                             <div className="flex flex-col">
                                 <span className={`text-xs font-serif tracking-wide ${provider === 'gemini' && useProxy ? 'text-white' : 'text-stone-400'}`}>
                                     {provider === 'siliconflow' ? '无需代理 (Direct)' : (useProxy ? '自定义代理 (Proxy On)' : '直连模式 (Proxy Off)')}
                                 </span>
                             </div>
                         </div>
                         
                         <div>
                             {provider === 'gemini' ? (
                                 useProxy ? (
                                     <ToggleRight className="w-6 h-6 text-lucid-glow transition-all" />
                                 ) : (
                                     <ToggleLeft className="w-6 h-6 text-stone-600 transition-all" />
                                 )
                             ) : <div className="w-6 h-6"></div>}
                         </div>
                     </div>
                     
                     {useProxy && provider === 'gemini' && (
                        <div className="animate-fade-in space-y-2">
                             <label className="text-xs text-lucid-glow uppercase tracking-wider font-bold">代理地址 Proxy URL</label>
                             <input 
                                type="text"
                                value={proxyUrlInput}
                                onChange={(e) => handleProxyChange(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lucid-glow/50 transition-all font-sans text-sm tracking-wide"
                             />
                        </div>
                     )}
                 </div>

                 <div className="mt-6 pt-6 border-t border-white/5">
                     <Button 
                        onClick={onSuccess}
                        className="w-full !rounded-xl !py-3 bg-white/10 hover:bg-white/20 !text-white border border-white/10"
                        variant="glass"
                     >
                        进入系统 Enter System <ArrowRight className="w-4 h-4 ml-2" />
                     </Button>
                     <p className="text-[10px] text-center text-stone-500 mt-3">
                         请确保已填写入住信息和密钥配置
                     </p>
                 </div>
            </div>
        </div>
    </div>
  );
};
