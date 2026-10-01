
import React, { useRef, useEffect, useState } from 'react';
import { Send, Sparkles, Check, ArrowRight, AlertCircle, Fingerprint, Lock, ShieldAlert, ArrowDown, Zap, Search, ListChecks, Map } from 'lucide-react';
import { Wish, ChatMessage, IntentState, JournalEntry, AgentToolStep } from '../types';
import { analyzeWishDeepDive, generateBeliefMapAndTags, generateAffirmations } from '../services/geminiService';
import { Button, Card, SectionTitle, LoadingSpinner } from './Shared';
import { useTheme } from '../contexts/ThemeContext';

interface IntentViewProps {
  state: IntentState;
  setState: React.Dispatch<React.SetStateAction<IntentState>>;
  onComplete: (wish: Wish) => void;
  onInteract?: () => void;
  /** Agent 工具数据源：历史日记 */
  journals?: JournalEntry[];
  /** Agent 工具数据源：在途愿望 */
  wishes?: Wish[];
}

const IntentView: React.FC<IntentViewProps> = ({ state, setState, onComplete, onInteract, journals = [], wishes = [] }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputCardRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Agent 工具调用轨迹（UI 展示模型的"行动"过程）
  const [agentTrace, setAgentTrace] = useState<AgentToolStep[]>([]);
  // 本轮对话的工作副本：流式增量直接改它，避免依赖异步 state 快照
  const workingRef = useRef<ChatMessage[]>([]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (inputCardRef.current) {
        const rect = inputCardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        inputCardRef.current.style.setProperty('--mouse-x', `${x}px`);
        inputCardRef.current.style.setProperty('--mouse-y', `${y}px`);
    }
  };
  
  // Auto-scroll for Chat
  // 流式期间用 'auto' 避免每个 token 都触发平滑滚动动画造成抖动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: state.isTyping ? 'auto' : 'smooth' });
  }, [state.messages, state.isTyping]);

  // 1. CHAT LOGIC
  const { isLightMode } = useTheme();

  /**
   * 把本轮"工作副本"以增量方式刷进 React state。
   * 流式对话的核心：setState(prev => ... + delta)，而不是一次性 setText。
   */
  const flushWorking = () => {
    setState(prev => {
      const msgs = [...prev.messages];
      const last = workingRef.current[workingRef.current.length - 1];
      const i = msgs.length - 1;
      if (last && i >= 0 && msgs[i].role === 'model') {
        msgs[i] = { ...msgs[i], text: last.text };
      }
      return { ...prev, messages: msgs };
    });
  };

  /**
   * 统一的"发起一轮深挖"入口：流式增量渲染 + Agent 工具循环。
   * @param historyBefore 本轮之前的完整对话历史（不含即将追加的模型占位气泡）
   */
  const runDeepDive = async (historyBefore: ChatMessage[]) => {
    // 追加一个空的 model 气泡作为流式落点
    const working: ChatMessage[] = [...historyBefore, { role: 'model', text: '' }];
    workingRef.current = working;
    setAgentTrace([]);
    setState(prev => ({ ...prev, messages: working, isTyping: true }));

    const userText = historyBefore[historyBefore.length - 1]?.text || '';

    const full = await analyzeWishDeepDive(userText, historyBefore, {
      ctx: { journals, wishes },
      onChunk: (delta) => {
        const last = workingRef.current[workingRef.current.length - 1];
        if (!last) return;
        last.text += delta;
        flushWorking();
      },
      onTool: (step) => setAgentTrace(prev => [...prev, step]),
      onProposeBeliefMap: () => {
        // 模型自主判断深挖已充分 → 流程控制权从代码交给模型
        void handleAnalyzeBlocks(workingRef.current);
      },
    });

    // 收尾对账：以 SDK 累积的完整文本为准，避免流式过程丢字
    const last = workingRef.current[workingRef.current.length - 1];
    if (last && last.role === 'model') {
      if (full) last.text = full;
    }
    flushWorking();
    setState(prev => ({ ...prev, isTyping: false }));
  };

  const handleStartDeepDive = async () => {
    if (!state.wishInput.trim()) return;
    const initialText = state.wishInput;
    const initialMessage: ChatMessage = { role: 'user', text: initialText };
    setState(prev => ({ ...prev, step: 'deep-dive', wishInput: '' }));
    await runDeepDive([initialMessage]);
  };

  const handleSendMessage = async () => {
    if (!state.wishInput.trim()) return;
    const textToSend = state.wishInput;
    const newMessage: ChatMessage = { role: 'user', text: textToSend };

    setState(prev => ({ ...prev, wishInput: '' }));

    await runDeepDive([...state.messages, newMessage]);
  };

  // 2. STAGE A: ANALYZE BLOCKS (Generates Belief Map only)
  const handleAnalyzeBlocks = async (messages?: ChatMessage[]) => {
    const source = messages && messages.length ? messages : state.messages;
    if (!source.length) return;
    setIsLoading(true);
    try {
        const context = source.map(m => `${m.role}: ${m.text}`).join('\n');
        const coreWish = source[0].text;
        
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

  // Agent 工具 → 图标/中文标签（用于轨迹展示）
  const toolMeta = (tool: string) => {
    if (tool === 'search_user_journals') return { icon: Search, label: '检索历史日记' };
    if (tool === 'get_active_wishes') return { icon: ListChecks, label: '读取在途愿望' };
    if (tool === 'propose_belief_map') return { icon: Map, label: '生成信念地图' };
    return { icon: Sparkles, label: tool };
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

      <div className={`flex-1 ${state.step === 'input' ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'} px-2 pb-4 relative`}>
        <div className="max-w-4xl mx-auto w-full h-full">
            {/* STEP 1: INPUT */}
            {state.step === 'input' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fade-in mt-16">
                <div className="w-full max-w-2xl text-center space-y-6">
                    <h3 className={`text-3xl font-serif tracking-wide ${isLightMode ? 'text-stone-800' : 'text-white/90'}`}>此刻，<br/>你想显化什么？</h3>
                    
                    {/* Centered Input Container */}
                    <div 
                        ref={inputCardRef}
                        onMouseMove={handleMouseMove}
                        style={{ '--mouse-x': '0px', '--mouse-y': '0px' } as React.CSSProperties}
                        className={`group relative w-full backdrop-blur-xl border rounded-[2rem] transition-all duration-500 focus-within:bg-opacity-10 focus-within:shadow-[0_0_30px_rgba(253,186,116,0.1)] flex items-center justify-center min-h-[130px] p-8 overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(600px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(251,146,60,0.08),transparent_40%)] before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500 before:pointer-events-none ${isLightMode ? 'bg-white/60 hover:bg-white/80 border-stone-200 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-200' : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/10 focus-within:border-lucid-glow/30 focus-within:bg-white/[0.04]'}`}
                    >
                        <textarea
                            className={`w-full bg-transparent border-none focus:ring-0 text-2xl text-center resize-none font-serif leading-relaxed outline-none h-auto ${isLightMode ? 'text-stone-800 placeholder-stone-400' : 'text-lucid-text placeholder-white/10'}`}
                            rows={1}
                            placeholder="在此写下你的心愿..."
                            value={state.wishInput}
                            onChange={(e) => setState(prev => ({ ...prev, wishInput: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                }
                            }}
                        />

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
                  <div className={`absolute inset-0 bg-gradient-to-r opacity-100 group-hover:opacity-80 transition-opacity duration-700 blur-md ${isLightMode ? 'from-orange-100 via-rose-100 to-orange-100' : 'from-orange-500/10 via-rose-500/20 to-orange-500/10'}`} />
                  
                  {/* Border ring */}
                  <div className={`absolute inset-0 border rounded-full opacity-50 transition-colors ${isLightMode ? 'border-orange-200 group-hover:border-orange-400' : 'border-lucid-glow/30 group-hover:border-lucid-glow/60'}`} />
                  
                  {/* Content */}
                  <span className={`relative z-10 flex items-center gap-3 text-lg font-serif tracking-[0.2em] transition-colors ${isLightMode ? 'text-orange-800 group-hover:text-orange-900' : 'text-lucid-glow group-hover:text-white'}`}>
                    <Sparkles className="w-4 h-4 opacity-70 group-hover:animate-pulse" />
                    开启对话
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                  </span>
                </button>

            </div>
            )}

            {/* STEP 2: DEEP DIVE CHAT */}
            {state.step === 'deep-dive' && (
            <div className={`flex flex-col h-full rounded-[2rem] border relative overflow-hidden shadow-inner ${isLightMode ? 'bg-white/60 border-stone-200' : 'bg-white/[0.02] border-white/5'}`}>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 no-scrollbar pb-64">
                {state.messages.map((msg, idx) => {
                    const isLast = idx === state.messages.length - 1;
                    const isStreamingHere = state.isTyping && isLast && msg.role === 'model';
                    // 空白的模型占位气泡不渲染，改用下方"思考中"指示器
                    if (msg.role === 'model' && !msg.text && isLast) return null;
                    return (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    <div className={`max-w-[90%] md:max-w-[85%] p-4 md:p-5 rounded-2xl text-base font-serif leading-loose tracking-wide shadow-sm ${
                        msg.role === 'user' ? (isLightMode ? 'bg-orange-100 text-stone-800 rounded-br-sm border border-orange-200' : 'bg-lucid-glow/20 text-white rounded-br-sm backdrop-blur-sm border border-lucid-glow/10') : (isLightMode ? 'bg-white/80 text-stone-700 rounded-bl-sm border border-stone-200' : 'bg-white/5 text-lucid-text rounded-bl-sm')
                    }`}>
                        {msg.role === 'model' && <div className={`text-xs font-sans mb-2 uppercase tracking-widest opacity-80 ${isLightMode ? 'text-orange-500' : 'text-lucid-accent'}`}>LUCID</div>}
                        {msg.text}
                        {/* 流式光标 */}
                        {isStreamingHere && (
                            <span className={`inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom animate-pulse ${isLightMode ? 'bg-orange-500' : 'bg-lucid-glow'}`} />
                        )}
                    </div>
                    </div>
                    );
                })}

                {/* 思考中：仅在还没有任何 token 落地时显示 */}
                {state.isTyping && !state.messages[state.messages.length - 1]?.text && (
                    <div className={`flex items-center gap-3 pl-2 text-sm font-sans ${isLightMode ? 'text-stone-500' : 'text-lucid-dim'}`}>
                        <LoadingSpinner />
                        <span>{agentTrace.length ? '正在为你检索…' : 'LUCID 正在聆听…'}</span>
                    </div>
                )}

                {/* Agent 工具调用轨迹 */}
                {agentTrace.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 py-2 animate-fade-in">
                        {agentTrace.map((step, i) => {
                            const { icon: Icon, label } = toolMeta(step.tool);
                            return (
                                <div
                                    key={i}
                                    title={step.summary}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-sans tracking-wide ${isLightMode ? 'bg-white/70 border-stone-200 text-stone-500' : 'bg-white/[0.03] border-white/10 text-lucid-dim'}`}
                                >
                                    <Icon className="w-3.5 h-3.5 opacity-70" />
                                    <span>{label}</span>
                                    <span className="opacity-50">·</span>
                                    <span className="opacity-70">{step.summary}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {state.messages.length > 1 && !state.isTyping && (
                    <div className="flex justify-center py-8 mb-40 animate-fade-in">
                        <Button 
                            onClick={() => handleAnalyzeBlocks()} 
                            disabled={isLoading}
                            variant="glass" 
                            className={`rounded-full px-8 py-3 text-sm min-w-[240px] shadow-[0_0_20px_rgba(253,186,116,0.1)] ${isLightMode ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-lucid-glow/30 text-lucid-glow hover:bg-lucid-glow/10'}`}
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
                
                <div className={`absolute bottom-0 left-0 right-0 p-3 md:p-5 backdrop-blur-2xl border-t z-20 ${isLightMode ? 'bg-white/80 border-stone-200' : 'bg-lucid-bg/95 border-white/5'}`}>
                <div className="flex gap-3 relative items-end">
                    <textarea
                    className={`flex-1 border rounded-2xl px-4 py-3 focus:outline-none font-serif resize-none h-14 text-base disabled:opacity-60 ${isLightMode ? 'bg-white border-stone-300 text-stone-800 focus:bg-white' : 'bg-white/5 border-white/10 text-white focus:bg-white/10'}`}
                    placeholder={state.isTyping ? 'LUCID 正在回应…' : '回复以继续挖掘...'}
                    value={state.wishInput}
                    disabled={state.isTyping}
                    onChange={(e) => setState(prev => ({ ...prev, wishInput: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    />
                    <Button onClick={handleSendMessage} variant="primary" className="h-14 w-14 !p-0 rounded-full" disabled={!state.wishInput.trim() || state.isTyping}>
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
                        <div className={`w-16 h-16 rounded-full border flex items-center justify-center mx-auto mb-4 animate-pulse-slow ${isLightMode ? 'bg-orange-50 border-orange-200' : 'bg-white/5 border-white/10'}`}>
                            <Fingerprint className={`w-8 h-8 ${isLightMode ? 'text-orange-600' : 'text-lucid-glow'}`} />
                        </div>
                        <h3 className={`text-2xl font-serif tracking-wide ${isLightMode ? 'text-stone-800' : 'text-white'}`}>潜意识模式识别</h3>
                        <p className={`text-sm font-serif tracking-wider max-w-lg mx-auto ${isLightMode ? 'text-stone-600' : 'text-lucid-dim'}`}>
                            "看见即是疗愈的开始。在植入新的肯定语之前，我们需要先识别并释放那些不再服务于你的旧模式。"
                        </p>
                    </div>

                    <div className="space-y-6">
                        {/* 1. Blocks & Fears (Red/Orange Tone) */}
                        <Card className={`border-rose-500/20 bg-gradient-to-br relative overflow-hidden ${isLightMode ? 'from-rose-50 to-white border-rose-100 shadow-sm' : 'from-rose-900/10 to-transparent'}`}>
                             <div className="flex items-center gap-2 mb-4 text-rose-300">
                                 <AlertCircle className={`w-5 h-5 ${isLightMode ? 'text-rose-600' : 'text-rose-300'}`} />
                                 <span className={`text-xs uppercase tracking-widest font-bold ${isLightMode ? 'text-rose-700' : 'text-rose-300'}`}>识别阻碍 Blocks Detected</span>
                             </div>
                             
                             <div className="space-y-4">
                                 <div>
                                     <span className={`text-[10px] uppercase tracking-widest block mb-2 ${isLightMode ? 'text-rose-500' : 'text-rose-400/70'}`}>限制性信念 Limiting Beliefs</span>
                                     <ul className="space-y-2">
                                         {state.generatedBeliefs.limitingBeliefs.map((b, i) => (
                                             <li key={i} className={`flex items-start gap-3 font-serif text-sm ${isLightMode ? 'text-stone-800' : 'text-stone-300'}`}>
                                                 <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500/50 flex-shrink-0"></span>
                                                 "{typeof b === 'object' ? (b as any).text || String(b) : b}"
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                                 
                                 <div className={`h-[1px] w-full ${isLightMode ? 'bg-rose-100' : 'bg-rose-500/10'}`}></div>

                                 <div>
                                     <span className={`text-[10px] uppercase tracking-widest block mb-2 ${isLightMode ? 'text-rose-500' : 'text-rose-400/70'}`}>情绪卡点 Emotional Barriers</span>
                                      <div className="flex flex-wrap gap-2">
                                         {state.generatedBeliefs.emotionalBlocks.map((b, i) => (
                                             <span key={i} className={`px-3 py-1 border rounded-full text-xs font-serif ${isLightMode ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-rose-500/10 border-rose-500/20 text-rose-200'}`}>
                                                 {typeof b === 'object' ? (b as any).text || String(b) : b}
                                             </span>
                                         ))}
                                      </div>
                                 </div>
                             </div>
                        </Card>

                        {/* 1.5. Supportive Beliefs (Blue/Indigo Tone) - NEW */}
                        {state.generatedBeliefs.supportiveBeliefs && state.generatedBeliefs.supportiveBeliefs.length > 0 && (
                            <Card className={`border-indigo-500/20 bg-gradient-to-br relative overflow-hidden ${isLightMode ? 'from-indigo-50 to-white border-indigo-100 shadow-sm' : 'from-indigo-900/10 to-transparent'}`}>
                                <div className="flex items-center gap-2 mb-4 text-indigo-300">
                                    <Zap className={`w-5 h-5 ${isLightMode ? 'text-indigo-600' : 'text-indigo-300'}`} />
                                    <span className={`text-xs uppercase tracking-widest font-bold ${isLightMode ? 'text-indigo-700' : 'text-indigo-300'}`}>内在优势 Inner Strengths</span>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <span className={`text-[10px] uppercase tracking-widest block mb-2 ${isLightMode ? 'text-indigo-500' : 'text-indigo-400/70'}`}>正确思路 & 积极心态 Supportive Beliefs</span>
                                        <ul className="space-y-2">
                                            {state.generatedBeliefs.supportiveBeliefs.map((b, i) => (
                                                <li key={i} className={`flex items-start gap-3 font-serif text-sm ${isLightMode ? 'text-stone-800' : 'text-stone-300'}`}>
                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500/50 flex-shrink-0"></span>
                                                    "{typeof b === 'object' ? (b as any).text || String(b) : b}"
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        )}

                        <div className="flex justify-center">
                            <ArrowDown className={`w-6 h-6 animate-bounce ${isLightMode ? 'text-stone-400' : 'text-stone-600'}`} />
                        </div>

                        {/* 2. New Identity (Emerald/Gold Tone) */}
                        <Card className={`border-emerald-500/20 bg-gradient-to-br relative overflow-hidden ${isLightMode ? 'from-emerald-50 to-white border-emerald-100 shadow-sm' : 'from-emerald-900/10 to-transparent'}`}>
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                 <Sparkles className="w-24 h-24" />
                             </div>
                             
                             <div className="flex items-center gap-2 mb-4 text-emerald-300">
                                 <ShieldAlert className={`w-5 h-5 ${isLightMode ? 'text-emerald-600' : 'text-emerald-300'}`} />
                                 <span className={`text-xs uppercase tracking-widest font-bold ${isLightMode ? 'text-emerald-700' : 'text-emerald-300'}`}>身份重塑 Identity Shift</span>
                             </div>

                             <div className="text-center py-4">
                                 <p className={`text-xs uppercase tracking-widest mb-3 ${isLightMode ? 'text-stone-500' : 'text-stone-400'}`}>From Old Self To...</p>
                                 <h4 className={`text-xl md:text-2xl font-serif leading-relaxed text-shadow-sm ${isLightMode ? 'text-stone-800' : 'text-white'}`}>
                                     "{typeof state.generatedBeliefs.newIdentity === 'object' ? (state.generatedBeliefs.newIdentity as any).name || (state.generatedBeliefs.newIdentity as any).text || JSON.stringify(state.generatedBeliefs.newIdentity) : state.generatedBeliefs.newIdentity}"
                                 </h4>
                             </div>
                        </Card>
                    </div>

                    <div className="flex justify-center pt-8">
                         <Button 
                             onClick={handleGenerateScript} 
                             disabled={isLoading}
                             variant="primary" 
                             className={`rounded-full px-10 py-4 text-base ${isLightMode ? 'shadow-[0_0_30px_rgba(251,146,60,0.2)] hover:shadow-[0_0_40px_rgba(251,146,60,0.3)]' : 'shadow-[0_0_30px_rgba(253,186,116,0.2)]'}`}
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
                    <h3 className={`text-xl font-serif ${isLightMode ? 'text-stone-800' : 'text-white'}`}>人生脚本已重写</h3>
                    <p className={`text-sm mt-2 font-serif tracking-wider ${isLightMode ? 'text-stone-600' : 'text-lucid-dim'}`}>确认你的新身份，我们将把这些频率植入潜意识。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {state.generatedAffirmations.map((aff, i) => (
                        <Card 
                            key={i} 
                            className={`border transition-all p-3 ${isLightMode ? 'bg-white/60 hover:bg-white border-stone-200 hover:border-orange-300' : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-lucid-glow/20'}`}
                        >
                            <span className={`text-[10px] uppercase tracking-widest mb-1 block font-sans ${
                                aff.type === 'conscious' ? (isLightMode ? 'text-orange-600' : 'text-orange-300') : aff.type === 'subconscious' ? (isLightMode ? 'text-rose-600' : 'text-rose-300') : (isLightMode ? 'text-emerald-600' : 'text-emerald-300')
                            }`}>
                                {aff.type === 'conscious' ? '显意识' : aff.type === 'subconscious' ? '潜意识' : '未来'}
                            </span>
                            <p className={`text-sm font-serif leading-relaxed ${isLightMode ? 'text-stone-800' : 'text-white'}`}>"{aff.text}"</p>
                        </Card>
                    ))}
                </div>
            </div>
            )}
        </div>
      </div>

      {/* FOOTER NAVIGATION */}
      {state.step !== 'input' && state.step !== 'deep-dive' && (
          <div className={`flex-shrink-0 p-4 border-t backdrop-blur-xl z-50 ${isLightMode ? 'bg-white/80 border-stone-200' : 'bg-lucid-bg/80 border-white/5'}`}>
             <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
                <Button 
                    onClick={() => {
                        if (state.step === 'belief-reveal') setState(prev => ({...prev, step: 'deep-dive'}));
                        if (state.step === 'affirmation-select') setState(prev => ({...prev, step: 'belief-reveal'}));
                    }} 
                    variant="ghost"
                    className={isLightMode ? 'text-stone-600 hover:bg-stone-100' : ''}
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
