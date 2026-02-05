import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Mail, Lock, User } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'register';
}

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/auth` : '/api/auth';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialView = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialView === 'login');

  useEffect(() => {
    setIsLogin(initialView === 'login');
  }, [initialView, isOpen]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const fullUrl = `${API_URL}${endpoint}`;
      console.log("Attempting auth request to:", fullUrl);
      
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: isLogin ? undefined : name }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Server Error: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      login(data.token, data.user);
      onClose();
    } catch (err: any) {
      console.error("Auth error:", err);
      // Display full URL in error message to help debugging
      const endpoint = isLogin ? '/login' : '/register';
      const fullUrl = `${API_URL}${endpoint}`;
      setError(`${err.message.replace('Server Error', '服务器连接错误')} (Requesting: ${fullUrl})`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md p-8 relative rounded-3xl border border-white/10 bg-[#1C1917]/90 shadow-2xl">
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white transition-colors">
          <X size={20} />
        </button>
        
        <h2 className="text-2xl font-serif text-white mb-8 text-center tracking-wide">
          {isLogin ? '登录' : '创建账号'}
        </h2>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 text-xs flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <span className="break-all">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lucid-glow transition-colors" size={18} />
              <input
                type="text"
                placeholder="您的名字"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-lucid-glow/50 focus:bg-white/10 transition-all font-sans tracking-wide"
                required
              />
            </div>
          )}
          
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-lucid-glow transition-colors" size={18} />
            <input
              type="email"
              placeholder="邮箱地址"
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
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-white/20 focus:outline-none focus:border-lucid-glow/50 focus:bg-white/10 transition-all font-sans tracking-wide"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-rose-400 hover:from-orange-600 hover:to-rose-500 rounded-2xl text-white font-serif font-medium tracking-widest shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-300"
          >
            {isLogin ? '登 录' : '注 册'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-stone-400 hover:text-white text-xs tracking-wider transition-colors border-b border-transparent hover:border-white/20 pb-0.5"
          >
            {isLogin ? "还没有账号？去注册" : "已有账号？去登录"}
          </button>
        </div>
      </div>
    </div>
  );
};
