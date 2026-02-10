import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  User, Settings, Key, Globe, 
  ToggleLeft, ToggleRight, 
  Mail, Lock, ArrowRight, LogOut, AlertTriangle, Wifi, Edit2, X, Check, Sun, Moon
} from 'lucide-react';
import { Button } from './Shared';

interface AuthPageProps {
  initialView?: 'login' | 'register';
  onBack: () => void;
  onStartSystem: () => void;
  
  // Config State from App.tsx
  userName: string;
  setUserName: (val: string) => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  useProxy: boolean;
  setUseProxy: (val: boolean) => void;
  proxyUrl: string;
  setProxyUrl: (val: string) => void;
  
  // Connection Test
  isTesting: boolean;
  testResult: 'success' | 'error' | null;
  errorMessage: string;
  onTestConnection: () => void;
}

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/auth` : '/api/auth';
const DEFAULT_API_KEY = import.meta.env.VITE_DEFAULT_API_KEY || '';
const DEFAULT_PROXY = import.meta.env.VITE_DEFAULT_PROXY_URL || '';

export const AuthPage: React.FC<AuthPageProps> = ({
  initialView = 'login',
  onBack,
  onStartSystem,
  userName, setUserName,
  apiKey, setApiKey,
  useProxy, setUseProxy,
  proxyUrl, setProxyUrl,
  isTesting, testResult, errorMessage, onTestConnection
}) => {
  const { login, logout, user, updateUser, isAuthenticated, token } = useAuth();
  const { isLightMode, toggleTheme } = useTheme();
  
  // Determine initial view: if authenticated, show profile (or stay on login/register if desired?)
  // Actually, if authenticated, we probably want to show profile/logout options.
  // But props say initialView is 'login' or 'register'.
  // We can derive a local state that respects authentication.
  
  const [isLogin, setIsLogin] = useState(initialView === 'login');

  // If user is authenticated, we are not in "Login/Register" mode strictly speaking.
  // But this component handles both. 
  // Let's rely on `user` object presence to toggle between Auth Forms and User Profile.
  
  // Local form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localName, setLocalName] = useState(''); // For register form
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    setIsLogin(initialView === 'login');
  }, [initialView]);

  // Sync local name with parent name when registering
  useEffect(() => {
    if (!isLogin) {
      setUserName(localName);
    }
  }, [localName, isLogin, setUserName]);

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditing && user) {
        setEditName(user.name || '');
        setEditPassword('');
        setProfileMessage(null);
    }
  }, [isEditing, user]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const fullUrl = `${API_URL}${endpoint}`;
      
      const body: any = { email, password };
      if (!isLogin) {
        body.name = localName;
      }

      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Server Error: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) throw new Error(data.error || '认证失败');

      login(data.token, data.user);
      
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError(err.message || "认证失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
      if (!user) return;
      setIsSavingProfile(true);
      setProfileMessage(null);

      try {
          const res = await fetch(`${API_URL}/profile`, {
              method: 'PUT',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  name: editName,
                  password: editPassword || undefined, // Only send if not empty
                  apiKey: user.apiKey, // Preserve existing
                  proxyUrl: user.proxyUrl, // Preserve existing
                  provider: user.provider // Preserve existing
              })
          });

          if (!res.ok) throw new Error('Failed to update profile');

          const updatedUser = await res.json();
           // Update local user state via login (which effectively updates the context)
           // We need the token, assuming it hasn't changed. 
           if (token) {
               login(token, updatedUser);
               setUserName(updatedUser.name); // Sync parent state
           }

          setProfileMessage({ type: 'success', text: '资料更新成功' });
          setTimeout(() => {
              setIsEditing(false);
              setProfileMessage(null);
          }, 1500);
      } catch (err) {
          console.error("Profile update error:", err);
          setProfileMessage({ type: 'error', text: '资料更新失败' });
      } finally {
          setIsSavingProfile(false);
      }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-serif transition-colors duration-500 ${isLightMode ? 'bg-[#FFFAF5] text-stone-800' : 'bg-[#1a1614] text-lucid-text'}`}>
       {/* Background Effects - Enhanced for Dreamy Landscape feel */}
       <div className="absolute inset-0 pointer-events-none overflow-hidden">
           {/* Main warm glow */}
           <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] animate-pulse-slow mix-blend-screen ${isLightMode ? 'bg-orange-200/40' : 'bg-orange-600/20'}`}></div>
           {/* Secondary rose accent - reduced size and intensity */}
           <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[80px] animate-float mix-blend-screen ${isLightMode ? 'bg-orange-100/50' : 'bg-rose-700/15'}`} style={{ animationDuration: '15s' }}></div>
           {/* Center light leak */}
           <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full blur-[60px] ${isLightMode ? 'bg-white/60' : 'bg-orange-400/5'}`}></div>
           
           {/* Landscape elements suggestion - subtle gradients */}
           <div className={`absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t z-0 ${isLightMode ? 'from-[#FFFAF5] via-[#FFFAF5]/80' : 'from-[#1a1614] via-[#1a1614]/80'} to-transparent`}></div>
       </div>

       <button 
         onClick={onBack} 
         className={`absolute top-6 left-6 z-50 transition-colors flex items-center gap-2 group ${isLightMode ? 'text-stone-500 hover:text-stone-900' : 'text-white/40 hover:text-white'}`}
       >
         <div className={`p-2 rounded-full border transition-all ${isLightMode ? 'bg-white/50 border-stone-200 group-hover:bg-white' : 'bg-white/5 border-white/5 group-hover:bg-white/10'}`}>
            <ArrowRight className="rotate-180 w-4 h-4" /> 
         </div>
         <span className="text-sm tracking-wide font-serif">返回</span>
       </button>


       <div className="z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-stretch">
         
         {/* LEFT COLUMN: Auth Card - Floating Glass Style */}
         <div className="flex flex-col gap-4 lg:h-full animate-fade-in-left perspective-1000">
           <div className={`flex-1 min-h-[540px] glass-panel p-6 md:p-8 rounded-[2.5rem] border backdrop-blur-2xl relative overflow-hidden group transition-all duration-700 flex flex-col ${isLightMode ? 'bg-white/60 border-stone-200 shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] hover:shadow-[0_8px_40px_0_rgba(251,146,60,0.1)]' : 'bg-white/[0.03] border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] hover:shadow-[0_8px_40px_0_rgba(253,186,116,0.1)]'}`}>
             
             {/* Subtle internal gradient */}
             <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${isLightMode ? 'from-orange-50/50 to-transparent opacity-60' : 'from-white/5 to-transparent opacity-50'}`}></div>

             <div className="flex-1 flex flex-col justify-center w-full">
             {!user ? (
               <div className="relative z-10">
                 <div className="mb-10">
                    <h2 className={`text-4xl font-serif mb-3 tracking-wide drop-shadow-sm ${isLightMode ? 'text-stone-800' : 'text-white'}`}>
                      {isLogin ? '登录' : '注册'}
                    </h2>
                    <p className={`text-sm font-serif tracking-wide opacity-80 ${isLightMode ? 'text-stone-500' : 'text-stone-400'}`}>
                      {isLogin ? '欢迎回到你的内心空间。' : '开启你的清醒之旅。'}
                    </p>
                 </div>

                 {authError && (
                   <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-xs flex items-start gap-3 backdrop-blur-md font-serif">
                     <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                     <span className="break-all leading-relaxed">{authError}</span>
                   </div>
                 )}

                 <form onSubmit={handleAuthSubmit} className="space-y-5">
                   {!isLogin && (
                     <div className="relative group">
                       <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isLightMode ? 'text-stone-400 group-focus-within:text-orange-500' : 'text-white/30 group-focus-within:text-lucid-glow'}`}>
                          <User size={18} />
                       </div>
                       <input
                         type="text"
                         placeholder="您的称呼"
                         value={localName}
                         onChange={(e) => setLocalName(e.target.value)}
                         className={`w-full border rounded-[1.5rem] py-4 pl-12 pr-6 focus:outline-none transition-all font-serif tracking-wide text-sm ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400 focus:border-orange-500/50 focus:bg-white hover:bg-white' : 'bg-black/20 border-white/5 text-white placeholder-white/20 focus:border-lucid-glow/40 focus:bg-black/40 hover:bg-black/30'}`}
                         required
                       />
                     </div>
                   )}
                   
                   <div className="relative group">
                     <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isLightMode ? 'text-stone-400 group-focus-within:text-orange-500' : 'text-white/30 group-focus-within:text-lucid-glow'}`}>
                        <Mail size={18} />
                     </div>
                     <input
                       type="email"
                       placeholder="邮箱地址"
                       value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       className={`w-full border rounded-[1.5rem] py-4 pl-12 pr-6 focus:outline-none transition-all font-serif tracking-wide text-sm ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400 focus:border-orange-500/50 focus:bg-white hover:bg-white' : 'bg-black/20 border-white/5 text-white placeholder-white/20 focus:border-lucid-glow/40 focus:bg-black/40 hover:bg-black/30'}`}
                       required
                     />
                   </div>
                   
                   <div className="relative group">
                     <div className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isLightMode ? 'text-stone-400 group-focus-within:text-orange-500' : 'text-white/30 group-focus-within:text-lucid-glow'}`}>
                        <Lock size={18} />
                     </div>
                     <input
                       type="password"
                       placeholder="密码"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className={`w-full border rounded-[1.5rem] py-4 pl-12 pr-6 focus:outline-none transition-all font-serif tracking-wide text-sm ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400 focus:border-orange-500/50 focus:bg-white hover:bg-white' : 'bg-black/20 border-white/5 text-white placeholder-white/20 focus:border-lucid-glow/40 focus:bg-black/40 hover:bg-black/30'}`}
                       required
                     />
                   </div>

                   <div className="pt-2 flex flex-col gap-3">
                       <button
                         type="submit"
                         disabled={isLoading}
                         className={`w-full py-2.5 border rounded-[1.2rem] font-serif text-xs tracking-[0.15em] shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group ${isLightMode ? 'bg-stone-800 text-white hover:bg-stone-900 border-stone-800 hover:shadow-[0_8px_25px_rgba(251,146,60,0.2)]' : 'bg-white/[0.08] hover:bg-white/[0.12] border-white/5 text-white/90 hover:shadow-[0_8px_25px_rgba(251,146,60,0.1)] hover:border-lucid-glow/20'}`}
                       >
                         {isLoading ? (
                           <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isLightMode ? 'border-white/30 border-t-white' : 'border-white/30 border-t-white'}`} />
                         ) : (
                           <>
                             <span className="uppercase font-medium">{isLogin ? '登录' : '创建账户'}</span>
                             <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                           </>
                         )}
                       </button>

                       <button
                         type="button"
                         onClick={() => setIsLogin(!isLogin)}
                         className={`text-[10px] tracking-wider transition-all opacity-60 hover:opacity-100 py-1 font-serif ${isLightMode ? 'text-stone-500 hover:text-stone-900' : 'text-stone-400 hover:text-white'}`}
                       >
                         {isLogin ? "新用户？创建账户" : "已有账户？登录"}
                       </button>
                   </div>
                 </form>
               </div>
             ) : (
              <div className="text-center py-8 space-y-6 relative z-10 w-full max-w-sm mx-auto">
                 {/* Profile Avatar */}
                 <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br flex items-center justify-center border p-1 ${isLightMode ? 'from-orange-200 to-transparent shadow-[0_0_40px_rgba(251,146,60,0.2)] border-orange-200' : 'from-lucid-glow/20 to-transparent shadow-[0_0_40px_rgba(253,186,116,0.1)] border-lucid-glow/20'}`}>
                   <div className={`w-full h-full rounded-full flex items-center justify-center ${isLightMode ? 'bg-white' : 'bg-[#1a1614]'}`}>
                       <User className={`w-10 h-10 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} />
                   </div>
                 </div>

                 {isEditing ? (
                    <div className="space-y-4 animate-fade-in">
                       <div className="space-y-1 text-left">
                          <label className={`text-[10px] uppercase tracking-widest pl-2 font-serif ${isLightMode ? 'text-stone-500' : 'text-stone-500'}`}>显示名称</label>
                          <input 
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none font-serif ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 focus:border-orange-500/50' : 'bg-black/20 border-white/10 text-white focus:border-lucid-glow/40'}`}
                          />
                       </div>
                       <div className="space-y-1 text-left">
                          <label className={`text-[10px] uppercase tracking-widest pl-2 font-serif ${isLightMode ? 'text-stone-500' : 'text-stone-500'}`}>新密码（可选）</label>
                          <input 
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="留空以保持当前密码"
                            className={`w-full border rounded-xl px-4 py-2 text-sm focus:outline-none font-serif ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 focus:border-orange-500/50' : 'bg-black/20 border-white/10 text-white focus:border-lucid-glow/40'}`}
                          />
                       </div>

                       {profileMessage && (
                           <div className={`text-xs p-2 rounded-lg font-serif ${profileMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'}`}>
                               {profileMessage.text}
                           </div>
                       )}

                       <div className="flex gap-2 pt-2">
                          <button 
                            onClick={() => setIsEditing(false)}
                            className={`flex-1 py-2 rounded-xl border text-xs tracking-wide transition-colors font-serif ${isLightMode ? 'border-stone-200 hover:bg-stone-100 text-stone-500' : 'border-white/5 hover:bg-white/5 text-stone-400'}`}
                          >
                            取消
                          </button>
                          <button 
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            className={`flex-1 py-2 rounded-xl border text-xs tracking-wide transition-colors flex items-center justify-center gap-2 font-serif ${isLightMode ? 'bg-orange-100 border-orange-200 text-orange-600 hover:bg-orange-200' : 'bg-lucid-glow/10 border-lucid-glow/20 text-lucid-glow hover:bg-lucid-glow/20'}`}
                          >
                            {isSavingProfile ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                            保存
                          </button>
                       </div>
                    </div>
                 ) : (
                    <div>
                       <div className="relative inline-block group">
                           <h2 className={`text-3xl font-serif tracking-wide ${isLightMode ? 'text-stone-800' : 'text-white'}`}>{user.name || '旅人'}</h2>
                           <button 
                             onClick={() => setIsEditing(true)}
                             className={`absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 ${isLightMode ? 'text-stone-400 hover:text-orange-600' : 'text-stone-500 hover:text-lucid-glow'}`}
                             title="编辑资料"
                           >
                              <Edit2 size={14} />
                           </button>
                       </div>
                       <p className={`text-sm mt-2 font-serif tracking-wide opacity-70 ${isLightMode ? 'text-stone-500' : 'text-stone-400'}`}>准备好探索你的内心了吗？</p>
                       <p className={`text-[10px] mt-2 font-serif tracking-wider uppercase opacity-50 ${isLightMode ? 'text-stone-400' : 'text-stone-600'}`}>{user.email}</p>
                    </div>
                 )}
                 
                 {!isEditing && (
                    <div className="flex flex-col gap-4 max-w-xs mx-auto pt-4">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            logout();
                            setUserName('');
                            // No navigation, let AuthContext handle state but we stay on this component 
                            // because AuthPage handles both logged-in (profile) and logged-out (login/register) states
                          }}
                          className={`w-full py-3 rounded-[1.5rem] border transition-all text-xs tracking-widest flex items-center justify-center gap-2 font-serif ${isLightMode ? 'border-stone-200 bg-white/50 hover:bg-rose-50 hover:border-rose-200 text-stone-500 hover:text-rose-500' : 'border-white/5 bg-white/[0.02] hover:bg-rose-500/10 hover:border-rose-500/20 text-stone-500 hover:text-rose-300'}`}
                        >
                          <LogOut size={14} /> 退出登录
                        </button>
                    </div>
                 )}
              </div>
            )}
             </div>

             {/* Minimal Footer */}
             <div className="pt-6 mt-4 border-t border-white/5 flex justify-between items-end opacity-50 relative z-10">
                <div className="text-[10px] text-stone-500 font-serif tracking-widest">
                   LUCID JOURNAL
                </div>
                <div className="text-[10px] text-stone-600 font-serif">
                   v1.0
                </div>
             </div>
           </div>

         </div>

         {/* RIGHT COLUMN: Settings - Minimalist Card */}
         <div className="flex flex-col gap-4 animate-fade-in-right delay-100 h-full">
           <div className={`glass-panel p-6 md:p-8 rounded-[2.5rem] border backdrop-blur-2xl shadow-2xl space-y-5 text-left relative overflow-hidden flex-1 flex flex-col w-full ${isLightMode ? 'bg-white/40 border-stone-200' : 'bg-white/[0.03] border-white/10'}`}>
             <div className={`absolute inset-0 bg-gradient-to-bl pointer-events-none ${isLightMode ? 'from-orange-50/30 to-transparent opacity-40' : 'from-white/5 to-transparent opacity-30'}`}></div>

             <div className="flex items-center justify-between mb-2 relative z-10">
                <div>
                   <p className={`text-sm tracking-wide mt-1 font-serif ${isLightMode ? 'text-stone-500' : 'text-stone-500'}`}>默认无需配置，可填自有 Key 提升稳定性。</p>
                </div>
                <div 
                  onClick={toggleTheme}
                  className={`p-3 rounded-full border cursor-pointer transition-all duration-300 hover:scale-105 ${isLightMode ? 'bg-white/50 border-stone-200 hover:bg-white hover:shadow-md' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}
                >
                   {isLightMode ? (
                       <Sun className="w-5 h-5 text-orange-500 opacity-80" />
                   ) : (
                       <Moon className="w-5 h-5 text-lucid-glow opacity-80" />
                   )}
                </div>
             </div>

             <div className="space-y-6 relative z-10">
                {/* API Key */}
                <div className="space-y-1">
                   <label className={`text-[10px] uppercase tracking-widest font-bold flex items-center justify-between pl-2 font-serif ${isLightMode ? 'text-orange-600/70' : 'text-lucid-glow/70'}`}>
                       Gemini API 密钥
                   </label>
                   <div className="relative group">
                       <input 
                         type="password"
                         value={apiKey === DEFAULT_API_KEY ? '' : apiKey}
                         onChange={(e) => setApiKey(e.target.value)}
                         placeholder={
                             apiKey === DEFAULT_API_KEY && DEFAULT_API_KEY.length > 0 
                                 ? "已使用默认配置 (安全隐藏)" 
                                 : "粘贴 AIzaSy... 密钥"
                         }
                         className={`w-full border rounded-[1.5rem] px-5 py-3 focus:outline-none transition-all font-serif text-sm tracking-wide ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400 focus:border-orange-500/50 focus:bg-white hover:bg-white' : 'bg-black/20 border-white/5 text-white placeholder-white/20 focus:border-lucid-glow/40 focus:bg-black/40 hover:bg-black/30'}`}
                      />
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${isLightMode ? 'text-stone-400 group-focus-within:text-orange-500' : 'text-white/20 group-focus-within:text-lucid-glow'}`}>
                          <Key size={14} />
                      </div>
                   </div>
                   <div className="flex justify-end">
                       <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className={`text-[10px] transition-colors flex items-center gap-1 font-serif ${isLightMode ? 'text-stone-500 hover:text-orange-600' : 'text-stone-500 hover:text-lucid-glow'}`}>
                           获取 Gemini Key <ArrowRight size={10} />
                       </a>
                   </div>
                </div>

                {/* Proxy Group - Combined for tighter spacing */}
                <div className="space-y-2">
                    {/* Proxy Toggle - Pill Style */}
                    <div 
                        onClick={() => setUseProxy(!useProxy)}
                        className={`
                            relative flex items-center justify-between p-2 pl-4 rounded-full border transition-all cursor-pointer group
                            ${useProxy 
                                ? (isLightMode 
                                    ? 'bg-orange-50 border-orange-200' 
                                    : 'bg-gradient-to-r from-orange-900/40 to-rose-900/40 border-lucid-glow/30')
                                : (isLightMode
                                    ? 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                                    : 'bg-black/20 border-white/5 hover:bg-white/[0.05]')
                            }
                        `}
                    >
                         <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${useProxy ? (isLightMode ? 'bg-orange-500 text-white' : 'bg-lucid-glow text-black') : (isLightMode ? 'bg-white text-stone-400' : 'bg-white/5 text-stone-500')}`}>
                                 <Globe size={14} />
                             </div>
                             <span className={`text-xs font-serif tracking-wide ${useProxy ? (isLightMode ? 'text-orange-900 font-bold' : 'text-white') : (isLightMode ? 'text-stone-500' : 'text-stone-500')}`}>
                                 {useProxy ? '国内访问代理已启用' : '直连模式'}
                             </span>
                         </div>
                         
                         <div className="pr-2">
                             {useProxy 
                                ? <ToggleRight className={`w-8 h-8 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} /> 
                                : <ToggleLeft className={`w-8 h-8 ${isLightMode ? 'text-stone-400' : 'text-stone-700'}`} />
                             }
                         </div>
                    </div>

                    {/* Proxy URL Input & Warning Area */}
                    <div className="space-y-1 transition-all duration-300 relative">
                       {/* Label or Warning Message - Swaps based on state */}
                       <div className="min-h-[20px] flex items-center pl-2">
                           {useProxy ? (
                               <label className={`text-[10px] uppercase tracking-widest font-bold font-serif animate-fade-in ${isLightMode ? 'text-orange-600/70' : 'text-lucid-glow/70'}`}>
                                   代理地址
                               </label>
                           ) : (
                               <p className="text-[10px] text-stone-500 font-serif tracking-wide animate-fade-in">
                                   请确认您在海外环境或已开启 VPN 代理。
                               </p>
                           )}
                       </div>

                       {/* Input Container - Always rendered to maintain height, hidden when unused */}
                       <div className={`relative flex gap-2 transition-all duration-300 ${useProxy ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                           <input 
                              type="text"
                              value={proxyUrl === DEFAULT_PROXY ? '' : proxyUrl}
                              onChange={(e) => setProxyUrl(e.target.value)}
                              placeholder={
                                  proxyUrl === DEFAULT_PROXY || (proxyUrl === '' && DEFAULT_PROXY)
                                      ? "默认代理已激活，点击右侧WIFI标测试连接性" 
                                      : "https://..."
                                }
                               className={`w-full border rounded-[1.5rem] px-5 py-3 focus:outline-none transition-all font-serif text-sm tracking-wide pr-14 ${isLightMode ? 'bg-stone-50 border-stone-200 text-stone-800 placeholder-stone-400 focus:border-orange-500/50 focus:bg-white' : 'bg-black/20 border-white/5 text-white placeholder-white/20 focus:border-lucid-glow/40 focus:bg-black/40 hover:bg-black/30'}`}
                               tabIndex={useProxy ? 0 : -1}
                            />
                           <button 
                             onClick={onTestConnection}
                             disabled={!useProxy || isTesting || apiKey.length < 5}
                             className={`
                                absolute right-2 top-1/2 -translate-y-1/2 w-10 h-8 rounded-xl flex items-center justify-center transition-all
                                ${testResult === 'success' 
                                   ? 'text-emerald-400 bg-emerald-500/10' 
                                   : testResult === 'error'
                                     ? 'text-rose-400 bg-rose-500/10'
                                     : (isLightMode ? 'text-stone-400 hover:text-stone-800' : 'text-stone-400 hover:text-white')
                                }
                             `}
                             tabIndex={useProxy ? 0 : -1}
                             title="测试连接"
                           >
                               {isTesting ? <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" /> : <Wifi size={16} />}
                           </button>
                       </div>
                       {errorMessage && useProxy && (
                          <p className="text-[10px] text-rose-400 pl-2 opacity-80 font-serif absolute -bottom-5 left-0">{errorMessage}</p>
                       )}
                    </div>
                </div>

                {/* AI Config State - Removed unused Model/Prompt selectors */}
             </div>

           </div>

           {/* Enter System Module - Moved to Right Column */}
           <div 
             onClick={() => user && onStartSystem()}
             className={`flex-none glass-panel p-6 rounded-[2.5rem] border backdrop-blur-xl flex items-center justify-between shadow-lg transition-all duration-500 relative overflow-hidden w-full
                 ${isLightMode ? 'bg-white/60' : 'bg-[#0c0a09]'}
                 ${user 
                    ? (isLightMode 
                        ? 'border-stone-200 cursor-pointer group hover:border-orange-300 hover:shadow-[0_8px_30px_rgba(249,115,22,0.1)]' 
                        : 'border-white/5 cursor-pointer group hover:border-lucid-glow/30 hover:shadow-[0_8px_30px_rgba(251,146,60,0.1)]')
                    : (isLightMode ? 'border-stone-200 opacity-50 cursor-not-allowed grayscale' : 'border-white/5 opacity-50 cursor-not-allowed grayscale')
                 }
             `}
           >
               <div className={`absolute inset-0 transition-opacity duration-500 ${isLightMode ? 'bg-gradient-to-r from-orange-100/50 to-rose-100/50' : 'bg-gradient-to-r from-orange-500/5 to-rose-500/5'} ${user ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}></div>
               <div className="flex flex-col pl-4 relative z-10 gap-1">
                 <h3 className={`text-sm font-serif tracking-wider italic ${isLightMode ? 'text-stone-500' : 'text-white/60'}`}>"唯一的旅程是向内的旅程。"</h3>
                 <div className="flex items-center gap-2 mt-2">
                     <span className={`text-lg font-serif tracking-wide transition-colors duration-300 ${user ? (isLightMode ? 'text-stone-800 group-hover:text-orange-600' : 'text-white group-hover:text-lucid-glow') : 'text-stone-600'}`}>
                         {user ? '进入系统' : '已锁定'}
                     </span>
                 </div>
               </div>
               <div className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-300 relative z-10
                   ${isLightMode ? 'bg-white' : 'bg-[#1a1614]'}
                   ${user 
                       ? (isLightMode 
                            ? 'border-stone-200 group-hover:scale-110 group-hover:border-orange-400 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]' 
                            : 'border-white/10 group-hover:scale-110 group-hover:border-lucid-glow/50 group-hover:shadow-[0_0_20px_rgba(251,146,60,0.3)]')
                       : (isLightMode ? 'border-stone-200' : 'border-white/5')
                   }
               `}>
                  {user ? (
                      <ArrowRight className={`w-6 h-6 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} />
                  ) : (
                      <Lock className="w-5 h-5 text-stone-700" />
                  )}
               </div>
            </div>
         </div>
       </div>
    </div>
  );
};
