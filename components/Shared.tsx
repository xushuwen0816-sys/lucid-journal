
import React, { useEffect } from 'react';
import { X, Disc, Volume2, SkipBack, Play, Pause, SkipForward } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'glass' | 'outline'; loading?: boolean }> = ({ className = '', variant = 'primary', loading = false, children, disabled, ...props }) => {
  const { isLightMode } = useTheme();
  
  const baseStyles = "px-6 py-3.5 rounded-2xl font-serif text-sm tracking-wider transition-all duration-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden";
  
  const variants = {
    // Warm gradient: Orange to Rose (Soft Sunset)
    primary: "bg-gradient-to-r from-orange-500 to-rose-400 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:brightness-110 font-medium",
    // Minimalist text
    ghost: isLightMode 
      ? "bg-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-200"
      : "bg-transparent text-lucid-dim hover:text-white hover:bg-white/5",
    // Clean glass
    glass: isLightMode
      ? "bg-white/40 backdrop-blur-md border border-stone-200 text-stone-800 hover:bg-white/60 hover:border-stone-300"
      : "bg-white/5 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 hover:border-white/20",
    // Thin outline
    outline: isLightMode
      ? "border border-stone-300 text-stone-600 hover:bg-stone-100"
      : "border border-white/10 text-lucid-glow hover:bg-white/5"
  };

  const spinnerColor = variant === 'primary' ? 'bg-white/80' : 'bg-lucid-glow/50';

  return (
    <button disabled={disabled || loading} className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {loading ? <LoadingSpinner className={spinnerColor} /> : children}
    </button>
  );
};

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string; onClick?: () => void }>(({ children, className = '', onClick, ...props }, ref) => {
  const { isLightMode } = useTheme();
  
  return (
    <div ref={ref} onClick={onClick} className={`${isLightMode ? 'bg-white/40 border-stone-200 hover:bg-white/60' : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'} backdrop-blur-2xl border rounded-3xl p-6 transition-all duration-700 ${className}`} {...props}>
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const LoadingSpinner: React.FC<{ className?: string }> = ({ className = "bg-lucid-glow/50" }) => (
  <div className="flex items-center justify-center space-x-2">
    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${className}`} style={{ animationDelay: '0s' }}></div>
    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${className}`} style={{ animationDelay: '0.3s' }}></div>
    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${className}`} style={{ animationDelay: '0.6s' }}></div>
  </div>
);

export const SectionTitle: React.FC<{ title: string; subtitle?: string; className?: string }> = ({ title, subtitle, className = '' }) => {
  const { isLightMode } = useTheme();

  return (
    <div className={`w-full flex flex-col items-end justify-start mb-2 animate-fade-in select-none pt-1 ${className}`}>
      <h2 className={`text-2xl font-light font-serif tracking-wide mb-1 text-right drop-shadow-sm ${isLightMode ? 'text-stone-800' : 'text-white/90'}`}>
        {title}
      </h2>
      {subtitle && (
        <div className="flex items-center gap-2 opacity-70">
          <p className={`font-serif text-xs tracking-[0.2em] uppercase text-right ${isLightMode ? 'text-stone-500' : 'text-lucid-dim'}`}>{subtitle}</p>
          <div className={`w-6 h-[1px] rounded-full ${isLightMode ? 'bg-stone-400/50' : 'bg-lucid-glow/50'}`}></div>
        </div>
      )}
    </div>
  );
};

export const TabNav: React.FC<{ 
  tabs: { id: string; label: string; icon?: React.ElementType; badge?: boolean }[]; 
  activeTab: string; 
  onTabChange: (id: any) => void; 
  className?: string;
}> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  const { isLightMode } = useTheme();

  return (
    <div className={`flex justify-center ${className}`}>
      <div className={`flex items-center p-1.5 rounded-full border backdrop-blur-2xl relative shadow-2xl transition-colors duration-500 ${isLightMode ? 'bg-white/40 border-stone-200 hover:border-stone-300' : 'bg-black/20 border-white/10 hover:border-white/20'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative px-6 py-2.5 rounded-full text-xs font-serif tracking-widest transition-all duration-300 z-10 flex items-center gap-2 group
              ${activeTab === tab.id 
                ? (isLightMode ? 'text-stone-800 scale-105 shadow-lg' : 'text-white scale-105 shadow-lg') 
                : (isLightMode ? 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50' : 'text-lucid-dim hover:text-white hover:bg-white/5')}
            `}
          >
            {activeTab === tab.id && (
               <div className={`absolute inset-0 rounded-full -z-10 animate-fade-in ${isLightMode ? 'bg-white border border-stone-200 shadow-[0_0_20px_rgba(0,0,0,0.05)]' : 'bg-gradient-to-r from-white/10 to-white/5 shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/10'}`}></div>
            )}
            {tab.icon && <tab.icon className={`w-4 h-4 transition-colors duration-300 ${activeTab === tab.id ? (isLightMode ? 'text-orange-500' : 'text-lucid-glow drop-shadow-[0_0_8px_rgba(253,186,116,0.5)]') : 'opacity-50 group-hover:opacity-80'}`} />}
            {tab.label}
            {tab.badge && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>}
          </button>
        ))}
      </div>
    </div>
  );
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title?: string; bodyClassName?: string; bodyRef?: React.RefObject<HTMLDivElement>; className?: string; titleClassName?: string }> = ({ isOpen, onClose, children, title, bodyClassName, bodyRef, className, titleClassName }) => {
    const { isLightMode } = useTheme();
    
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className={`absolute inset-0 backdrop-blur-sm transition-opacity ${isLightMode ? 'bg-stone-900/20' : 'bg-black/60'}`}
                onClick={onClose}
            ></div>
            
            {/* Content */}
            <div className={`relative rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-fade-in ${isLightMode ? 'bg-white border border-stone-200 shadow-xl' : 'bg-[#1C1917] border border-white/10'} ${className || ''}`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 md:p-6 border-b ${isLightMode ? 'border-stone-100 bg-stone-50/50' : 'border-black/5 bg-black/[0.02]'}`}>
                    <h3 className={`text-xl font-serif tracking-wide opacity-90 ${titleClassName ? titleClassName : (isLightMode ? 'text-stone-800' : 'text-white')}`}>{title}</h3>
                    <button onClick={onClose} className={`p-2 rounded-full transition-colors opacity-50 hover:opacity-100 ${isLightMode ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-black/5 text-white'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Scrollable Body */}
                <div ref={bodyRef} className={`flex-1 overflow-y-auto custom-scrollbar ${bodyClassName ?? 'p-4 md:p-6'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export const SimpleMarkdown: React.FC<{ content: any }> = ({ content }) => {
  const { isLightMode } = useTheme();

  if (content === null || content === undefined) return null;

  // Defensive conversion to string
  let safeContent = "";
  if (typeof content === 'string') {
      safeContent = content;
  } else if (typeof content === 'object') {
      // Handle case where content might be null inside object or missing keys
      safeContent = content.text || content.content || "";
      if (!safeContent && Object.keys(content).length > 0) {
          safeContent = JSON.stringify(content);
      }
  } else {
      safeContent = String(content);
  }

  // If safeContent is still empty/null after processing, return null to avoid errors
  if (!safeContent) return null;

  // Pre-process content: handle escaped newlines (\n) that might come from JSON responses
  // and ensure they are treated as real newlines for splitting.
  const processedContent = safeContent.replace(/\\n/g, '\n');

  // Split content by newlines to handle line-by-line processing
  const lines = processedContent.split('\n');

  const parseInline = (text: string) => {
      // Handle **bold**
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className={`font-medium ${isLightMode ? 'text-stone-900' : 'text-white'}`}>{part.slice(2, -2)}</strong>;
          }
          return part;
      });
  };

  const parseLine = (line: string, index: number) => {
      // 1. Headers
      if (line.match(/^###\s+(.*)/)) {
          return <h4 key={index} className={`text-base font-bold mt-4 mb-2 ${isLightMode ? 'text-orange-600' : 'text-lucid-glow'}`}>{parseInline(line.replace(/^###\s+/, ''))}</h4>;
      }
      if (line.match(/^##\s+(.*)/)) {
          return <h3 key={index} className={`text-lg font-bold mt-6 mb-3 border-l-2 pl-3 ${isLightMode ? 'text-stone-800 border-orange-300' : 'text-white border-lucid-glow/50'}`}>{parseInline(line.replace(/^##\s+/, ''))}</h3>;
      }
      if (line.match(/^#\s+(.*)/)) {
          return <h2 key={index} className={`text-xl font-bold mt-8 mb-4 ${isLightMode ? 'text-stone-900' : 'text-white'}`}>{parseInline(line.replace(/^#\s+/, ''))}</h2>;
      }

      // 2. Lists
      if (line.match(/^[-*]\s+(.*)/)) {
          return (
            <div key={index} className="flex items-start gap-2 mb-2 ml-2">
                <span className={`mt-1.5 block w-1 h-1 rounded-full flex-shrink-0 ${isLightMode ? 'bg-orange-400' : 'bg-lucid-glow'}`}></span>
                <span className={`text-sm leading-relaxed ${isLightMode ? 'text-stone-600' : 'text-stone-300'}`}>{parseInline(line.replace(/^[-*]\s+/, ''))}</span>
            </div>
          );
      }
      
      // 3. Separators
      if (line.trim() === '---') {
          return <hr key={index} className={`my-4 ${isLightMode ? 'border-stone-200' : 'border-white/10'}`} />;
      }

      // 4. Empty lines
      if (line.trim() === '') {
          return <div key={index} className="h-2"></div>;
      }

      // 5. Regular Paragraphs
      // REMOVED text-sm and text-stone-300 to allow inheritance from parent container
      return <p key={index} className="leading-relaxed mb-2 font-serif opacity-90">{parseInline(line)}</p>;
  };

  return (
      <div className="markdown-content">
          {lines.map((line, i) => parseLine(line, i))}
      </div>
  );
};

export const StickyPlayer: React.FC<{
    isPlaying: boolean;
    title: string;
    subtitle?: string;
    trackType: 'subliminal' | 'tts' | 'bgm' | null;
    progress?: number;
    onPlayPause: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onStop: () => void;
}> = ({ isPlaying, title, subtitle, trackType, progress = 0, onPlayPause, onNext, onPrev, onStop }) => {
    const { isLightMode } = useTheme();
    
    if (!trackType) return null;

    return (
        // Adjusted bottom position: bottom-[4.5rem] on mobile to ensure it sits tightly above navigation
        <div className="fixed bottom-[4.5rem] md:bottom-0 left-0 right-0 p-4 z-[100] pointer-events-none animate-fade-in">
            <div className={`max-w-lg mx-auto backdrop-blur-2xl border rounded-2xl p-4 shadow-2xl pointer-events-auto relative overflow-hidden group transition-all duration-500 ${isLightMode ? 'bg-white/95 border-stone-200 shadow-stone-300/50' : 'bg-[#1C1917]/95 border-white/10 shadow-black/50'}`}>
                
                {/* Real Progress Bar - Height increased to h-1 for better visibility */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${isLightMode ? 'bg-stone-100' : 'bg-white/10'}`}>
                    <div 
                        className="h-full bg-gradient-to-r from-orange-400 to-rose-400 transition-all duration-300 ease-linear" 
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    ></div>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    {/* Album Art / Icon */}
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg border transition-all duration-700 ${trackType === 'subliminal' ? 'bg-gradient-to-br from-orange-900 to-rose-900 border-white/10' : (isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-white/5 border-white/5')}`}>
                        {trackType === 'subliminal' ? (
                            <Disc className={`w-7 h-7 text-white/90 ${isPlaying ? 'animate-spin-slow' : ''}`}/>
                        ) : (
                            <Volume2 className={`w-7 h-7 ${isLightMode ? 'text-stone-600' : 'text-white/90'}`}/>
                        )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className={`text-base font-serif truncate font-medium tracking-wide ${isLightMode ? 'text-stone-900' : 'text-white'}`}>{title}</div>
                        <div className={`text-[11px] font-sans tracking-widest uppercase flex items-center gap-2 ${isLightMode ? 'text-stone-500' : 'text-stone-400'}`}>
                             {isPlaying ? (
                                 <span className="flex items-center gap-1 text-lucid-glow"><div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div> Playing</span>
                             ) : 'Paused'}
                             {subtitle && <span className="opacity-20">•</span>}
                             {subtitle}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                         {onPrev && (
                             <button onClick={onPrev} className={`transition-colors active:scale-90 ${isLightMode ? 'text-stone-400 hover:text-stone-800' : 'text-stone-400 hover:text-white'}`}><SkipBack className="w-6 h-6 fill-current opacity-70"/></button>
                         )}
                         
                         <button 
                            onClick={onPlayPause}
                            className={`w-12 h-12 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg active:scale-95 ${isLightMode ? 'bg-stone-900 text-white shadow-stone-900/10' : 'bg-white text-black shadow-white/10'}`}
                         >
                            {isPlaying ? <Pause className="w-5 h-5 fill-current"/> : <Play className="w-5 h-5 fill-current ml-1"/>}
                         </button>

                         {onNext && (
                            <button onClick={onNext} className={`transition-colors active:scale-90 ${isLightMode ? 'text-stone-400 hover:text-stone-800' : 'text-stone-400 hover:text-white'}`}><SkipForward className="w-6 h-6 fill-current opacity-70"/></button>
                         )}
                         
                         <div className={`w-[1px] h-8 mx-2 ${isLightMode ? 'bg-stone-200' : 'bg-white/10'}`}></div>

                         <button onClick={onStop} className={`transition-colors p-2 rounded-full ${isLightMode ? 'text-stone-400 hover:text-rose-500 hover:bg-stone-100' : 'text-stone-500 hover:text-rose-400 hover:bg-white/5'}`}><X className="w-5 h-5"/></button>
                    </div>
                </div>
            </div>
        </div>
    );
};
