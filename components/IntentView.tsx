
import React, { useRef, useEffect, useState } from 'react';
import { Send, Sparkles, Check, ArrowRight, AlertCircle, Fingerprint, Lock, ShieldAlert, ArrowDown } from 'lucide-react';
import { Wish, ChatMessage, IntentState } from '../types';
import { analyzeWishDeepDive, generateBeliefMapAndTags, generateAffirmations } from '../services/geminiService';
import { Button, Card, SectionTitle, LoadingSpinner } from './Shared';

interface IntentViewProps {
  state: IntentState;
  setState: React.Dispatch<React.SetStateAction<IntentState>>;
  onComplete: (wish: Wish) => void;
  onInteract?: () => void; 
}

const IntentView: React.FC<IntentViewProps> = ({ state, setState, onComplete, onInteract }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto-scroll for Chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.isTyping]);

  // 1. CHAT LOGIC
  const handleStartDeepDive = async () => {
    if (!state.wishInput.trim()) return;
    const initialText = state.wishInput;
    const initialMessage: ChatMessage = { role: 'user', text: initialText };
    setState(prev => ({ ...prev, step: 'deep-dive', wishInput: '', messages: [initialMessage], isTyping: true }));
    // Pass structured history
    const response = await analyzeWishDeepDive(initialText, [initialMessage]);
    setState(prev => ({ ...prev, messages: [...prev.messages, { role: 'model', text: response }], isTyping: false }));
  };

  const handleSendMessage = async () => {
    if (!state.wishInput.trim()) return;
    const textToSend = state.wishInput;
    const newMessage: ChatMessage = { role: 'user', text: textToSend };
    
    setState(prev => ({ ...prev, wishInput: '', messages: [...prev.messages, newMessage], isTyping: true }));
    
    // Pass structured history
    const history = [...state.messages, newMessage];
    const response = await analyzeWishDeepDive(textToSend, history);
    
    setState(prev => ({ ...prev, messages: [...prev.messages, { role: 'model', text: response }], isTyping: false }));
  };

  // 2. STAGE A: ANALYZE BLOCKS (Generates Belief Map only)
  const handleAnalyzeBlocks = async () => {
    setIsLoading(true);
    try {
        const context = state.messages.map(m => `${m.role}: ${m.text}`).join('\n');
        const coreWish = state.messages[0].text;
        
        const { beliefs, tags } = await generateBeliefMapAndTags(coreWish, context);
        
        setState(prev => ({
            ...prev,
            step: 'belief-reveal',
            generatedBeliefs: beliefs,
            generatedTags: tags,
        }));
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  // 3. STAGE B: GENERATE SCRIPT (Generates Affirmations based on Beliefs)
  const handleGenerateScript = async () => {
      setIsLoading(true);
      try {
          const coreWish = state.messages[0].text;
          const beliefs = state.generatedBeliefs;

          if (!beliefs) {
              // Fallback safety
              await handleAnalyzeBlocks(); // Retry analysis if missing
              return;
          }

          const affirmations = await generateAffirmations(coreWish, beliefs);

          setState(prev => ({
              ...prev,
              step: 'affirmation-select',
              generatedAffirmations: affirmations
          }));
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  // 4. FINAL SAVE
  const handleSave = async () => {
     setIsLoading(true);

     const coreWish = state.messages[0].text;
     const beliefs = state.generatedBeliefs;
     const tags = state.generatedTags;
     
     if (!beliefs || !tags) {
         setIsLoading(false);
         return; // Should not happen in normal flow
     }

     const newWish: Wish = {
        id: crypto.randomUUID(),
        content: coreWish,
        createdAt: Date.now(),
        status: 'active',
        tags: tags,
        deepDiveChat: state.messages,
        beliefs: beliefs,
        affirmations: state.generatedAffirmations,
     };
     
     setTimeout(() => {
         onComplete(newWish);
         setIsLoading(false);
         // Reset
         setState({
             step: 'input', wishInput: '', messages: [], isTyping: false,
             generatedAffirmations: [], generatedBeliefs: undefined, generatedTags: undefined
         });
     }, 800);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden font-serif">
      <div className="flex-shrink-0">
        <SectionTitle title="我的愿望" subtitle={
           state.step === 'input' ? 'INTENT · 播种意图' :
           state.step === 'deep-dive' ? 'DEEP DIVE · 潜意识对话' :
           state.step === 'belief-reveal' ? 'AWARENESS · 觉察限制' :
           'ALIGNMENT · 能量校准'
        } />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 relative">
        <div className="max-w-4xl mx-auto w-full h-full">
            {/* STEP 1: INPUT */}
            {state.step === 'input' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fade-in">
                <div className="w-full max-w-2xl text-center space-y-6">
                    <h3 className="text-3xl font-serif text-white/90 tracking-wide">此刻，<br/>你想显化什么？</h3>
                    
                    {/* Centered Input Container */}
                    <div className="group relative w-full bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[2rem] transition-all duration-500 focus-within:border-lucid-glow/30 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_30px_rgba(253,186,116,0.1)] flex items-center justify-center min-h-[130px] p-8">
                        <textarea
                            className="w-full bg-transparent border-none focus:ring-0 text-2xl text-center resize-none placeholder-white/10 font-serif leading-relaxed text-lucid-text outline-none h-auto"
                            rows={1}
                            placeholder="在此写下你的心愿..."
                            value={state.wishInput}
                            onChange={(e) => setState(prev => ({ ...prev, wishInput: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleStartDeepDive();
                                }
                            }}
                        />
                        {/* Enter hint */}
                        {state.wishInput && (
                            <div className="absolute bottom-4 right-6 text-[10px] text-stone-500 font-sans tracking-widest uppercase animate-fade-in opacity-50">
                                Press Enter
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Redesigned Button - Improved Visibility */}
                <button
                  onClick={handleStartDeepDive}
                  disabled={!state.wishInput}
                  className={`
                    group relative overflow-hidden rounded-full px-12 py-4 transition-all duration-700 ease-out
                    ${!state.wishInput ? 'opacity-70 cursor-not-allowed brightness-90' : 'hover:scale-105 hover:shadow-[0_0_40px_rgba(253,186,116,0.2)]'}
                  `}
                >
                  {/* Subtle Glow Background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-rose-500/20 to-orange-500/10 opacity-100 group-hover:opacity-80 transition-opacity duration-700 blur-md" />
                  
                  {/* Border ring */}
                  <div className="absolute inset-0 border border-lucid-glow/30 rounded-full opacity-50 group-hover:border-lucid-glow/60 transition-colors" />

                  {/* Content */}
                  <span className="relative z-10 flex items-center gap-3 text-lg font-serif text-lucid-glow tracking-[0.2em] group-hover:text-white transition-colors">
                    <Sparkles className="w-4 h-4 opacity-70 group-hover:animate-pulse" />
                    开启对话
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                  </span>
                </button>

            </div>
            )}

            {/* STEP 2: DEEP DIVE CHAT */}
            {state.step === 'deep-dive' && (
            <div className="flex flex-col h-full bg-white/[0.02] rounded-[2rem] border border-white/5 relative overflow-hidden shadow-inner">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-64">
                {state.messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`max-w-[90%] md:max-w-[85%] p-4 md:p-5 rounded-2xl text-base font-serif leading-loose tracking-wide shadow-sm ${
                        msg.role === 'user' ? 'bg-lucid-glow/20 text-white rounded-br-sm backdrop-blur-sm border border-lucid-glow/10' : 'bg-white/5 text-lucid-text rounded-bl-sm'
                    }`}>
                        {msg.role === 'model' && <div className="text-xs font-sans text-lucid-accent mb-2 uppercase tracking-widest opacity-80">LUCID</div>}
                        {msg.text}
                    </div>
                    </div>
                ))}
                {state.isTyping && <div className="pl-4"><LoadingSpinner /></div>}
                
                {state.messages.length > 1 && (
                    <div className="flex justify-center py-8 mb-40 animate-fade-in">
                        <Button 
                            onClick={handleAnalyzeBlocks} 
                            disabled={isLoading}
                            variant="glass" 
                            className="rounded-full px-8 py-3 text-sm border-lucid-glow/30 text-lucid-glow hover:bg-lucid-glow/10 min-w-[240px] shadow-[0_0_20px_rgba(253,186,116,0.1)]"
                        >
                        {isLoading ? (
                            <><LoadingSpinner /> <span className="ml-2">正在深度扫描潜意识...</span></>
                        ) : (
                            <>✨ 意图已清晰？点击进行深度觉察</>
                        )}
                        </Button>
                    </div>
                )}
                
                <div ref={messagesEndRef} className="h-40" />
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5 bg-lucid-bg/95 backdrop-blur-2xl border-t border-white/5 z-20">
                <div className="flex gap-3 relative items-end">
                    <textarea
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:bg-white/10 font-serif resize-none h-14 text-base"
                    placeholder="回复以继续挖掘..."
                    value={state.wishInput}
                    onChange={(e) => setState(prev => ({ ...prev, wishInput: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    />
                    <Button onClick={handleSendMessage} variant="primary" className="h-14 w-14 !p-0 rounded-full" disabled={!state.wishInput.trim()}>
                    <Send className="w-5 h-5" />
                    </Button>
                </div>
                </div>
            </div>
            )}

            {/* STEP 3: BELIEF REVEAL (NEW STEP) */}
            {state.step === 'belief-reveal' && state.generatedBeliefs && (
                <div className="flex flex-col gap-8 animate-fade-in pb-32 max-w-2xl mx-auto pt-6">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse-slow">
                            <Fingerprint className="w-8 h-8 text-lucid-glow" />
                        </div>
                        <h3 className="text-2xl font-serif text-white tracking-wide">潜意识模式识别</h3>
                        <p className="text-lucid-dim text-sm font-serif tracking-wider max-w-lg mx-auto">
                            "看见即是疗愈的开始。在植入新的肯定语之前，我们需要先识别并释放那些不再服务于你的旧模式。"
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* 1. Blocks & Fears (Red/Orange Tone) */}
                        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-900/10 to-transparent relative overflow-hidden">
                             <div className="flex items-center gap-2 mb-4 text-rose-300">
                                 <AlertCircle className="w-5 h-5" />
                                 <span className="text-xs uppercase tracking-widest font-bold">识别阻碍 Blocks Detected</span>
                             </div>
                             
                             <div className="space-y-4">
                                 <div>
                                     <span className="text-[10px] text-rose-400/70 uppercase tracking-widest block mb-2">限制性信念 Limiting Beliefs</span>
                                     <ul className="space-y-2">
                                         {state.generatedBeliefs.limitingBeliefs.map((b, i) => (
                                             <li key={i} className="flex items-start gap-3 text-stone-300 font-serif text-sm">
                                                 <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500/50 flex-shrink-0"></span>
                                                 "{b}"
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                                 
                                 <div className="h-[1px] bg-rose-500/10 w-full"></div>

                                 <div>
                                     <span className="text-[10px] text-rose-400/70 uppercase tracking-widest block mb-2">情绪卡点 Emotional Barriers</span>
                                      <div className="flex flex-wrap gap-2">
                                         {state.generatedBeliefs.emotionalBlocks.map((b, i) => (
                                             <span key={i} className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-xs text-rose-200 font-serif">
                                                 {b}
                                             </span>
                                         ))}
                                      </div>
                                 </div>
                             </div>
                        </Card>

                        <div className="flex justify-center">
                            <ArrowDown className="w-6 h-6 text-stone-600 animate-bounce" />
                        </div>

                        {/* 2. New Identity (Emerald/Gold Tone) */}
                        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-900/10 to-transparent relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                 <Sparkles className="w-24 h-24" />
                             </div>
                             
                             <div className="flex items-center gap-2 mb-4 text-emerald-300">
                                 <ShieldAlert className="w-5 h-5" />
                                 <span className="text-xs uppercase tracking-widest font-bold">身份重塑 Identity Shift</span>
                             </div>

                             <div className="text-center py-4">
                                 <p className="text-stone-400 text-xs uppercase tracking-widest mb-3">From Old Self To...</p>
                                 <h4 className="text-xl md:text-2xl font-serif text-white leading-relaxed text-shadow-sm">
                                     "{state.generatedBeliefs.newIdentity}"
                                 </h4>
                             </div>
                        </Card>
                    </div>

                    <div className="flex justify-center pt-8">
                         <Button 
                             onClick={handleGenerateScript} 
                             disabled={isLoading}
                             variant="primary" 
                             className="rounded-full px-10 py-4 text-base shadow-[0_0_30px_rgba(253,186,116,0.2)]"
                         >
                             {isLoading ? (
                                 <><LoadingSpinner /> <span className="ml-2">正在重写潜意识脚本...</span></>
                             ) : (
                                 <>确认重塑，生成肯定语 <ArrowRight className="w-4 h-4 ml-2" /></>
                             )}
                         </Button>
                    </div>
                </div>
            )}

            {/* STEP 4: AFFIRMATION SELECT */}
            {state.step === 'affirmation-select' && (
            <div className="flex flex-col gap-4 animate-fade-in pb-32 max-w-2xl mx-auto pt-6">
                <div className="text-center mb-6">
                    <h3 className="text-xl font-serif text-white">人生脚本已重写</h3>
                    <p className="text-lucid-dim text-sm mt-2 font-serif tracking-wider">确认你的新身份，我们将把这些频率植入潜意识。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {state.generatedAffirmations.map((aff, i) => (
                        <Card 
                            key={i} 
                            className="border border-white/5 hover:bg-white/5 transition-all bg-white/[0.02] hover:border-lucid-glow/20 p-3"
                        >
                            <span className={`text-[10px] uppercase tracking-widest mb-1 block font-sans ${
                                aff.type === 'conscious' ? 'text-orange-300' : aff.type === 'subconscious' ? 'text-rose-300' : 'text-emerald-300'
                            }`}>
                                {aff.type === 'conscious' ? '显意识' : aff.type === 'subconscious' ? '潜意识' : '未来'}
                            </span>
                            <p className="text-sm font-serif text-white leading-relaxed">"{aff.text}"</p>
                        </Card>
                    ))}
                </div>
            </div>
            )}
        </div>
      </div>

      {/* FOOTER NAVIGATION */}
      {state.step !== 'input' && state.step !== 'deep-dive' && (
          <div className="flex-shrink-0 p-4 border-t border-white/5 bg-lucid-bg/80 backdrop-blur-xl z-50">
             <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
                <Button 
                    onClick={() => {
                        if (state.step === 'belief-reveal') setState(prev => ({...prev, step: 'deep-dive'}));
                        if (state.step === 'affirmation-select') setState(prev => ({...prev, step: 'belief-reveal'}));
                    }} 
                    variant="ghost"
                >
                    返回
                </Button>

                {state.step === 'affirmation-select' && (
                    <Button onClick={handleSave} disabled={isLoading} variant="primary" className="rounded-full px-8">
                        {isLoading ? <LoadingSpinner /> : <><Check className="w-4 h-4 mr-2" /> 保存愿望</>}
                    </Button>
                )}
             </div>
          </div>
      )}
    </div>
  );
};

export default IntentView;
