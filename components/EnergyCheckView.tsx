

import React, { useState, useEffect, useRef } from 'react';
import { generateTarotReading, generateDailyPractice, generateOracleReading } from '../services/geminiService';
import { TarotReading, DailyPractice, Wish } from '../types';
import { Button, Card, SectionTitle, LoadingSpinner, TabNav } from './Shared';
import { CreditCard, Sun, Shuffle, RotateCcw, MoveHorizontal, Sparkles } from 'lucide-react';
import { ORACLE_DECK } from './OracleDeckData';

interface EnergyCheckViewProps {
    wishes?: Wish[];
    onSaveRitual: (data: { date: number, reading?: TarotReading, practice?: DailyPractice }) => void;
}

// Helper to safely render text that might be an object
const safeRender = (val: any): string => {
    if (!val) return "";
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        return val.text || val.content || val.description || val.meaning || val.name || JSON.stringify(val);
    }
    return String(val);
};

// Full 78 Cards Data Generator (Chinese)
const generateTarotDeck = () => {
    const majors = [
        "愚者", "魔术师", "女祭司", "女皇", "皇帝", 
        "教皇", "恋人", "战车", "力量", "隐士", 
        "命运之轮", "正义", "倒吊人", "死神", "节制", 
        "恶魔", "高塔", "星星", "月亮", "太阳", 
        "审判", "世界"
    ];
    const suits = ["权杖", "圣杯", "宝剑", "星币"];
    const ranks = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"];
    
    let deck: { id: number; name: string; isReversed: boolean; type: 'tarot' }[] = [];
    let idCounter = 0;

    majors.forEach(m => deck.push({ id: idCounter++, name: m, isReversed: false, type: 'tarot' }));
    suits.forEach(suit => {
        ranks.forEach(rank => {
            deck.push({ id: idCounter++, name: `${suit}${rank}`, isReversed: false, type: 'tarot' });
        });
    });
    return deck;
};

// Oracle Deck Generator
const generateOracleDeckState = () => {
    return ORACLE_DECK.map(card => ({
        id: card.id,
        name: card.name,
        isReversed: false, // Oracle cards typically don't use reversals in this app context
        keywords: card.keywords,
        meaning: card.meaning,
        description: card.description,
        type: 'oracle' as const
    }));
};

const EnergyCheckView: React.FC<EnergyCheckViewProps> = ({ wishes = [], onSaveRitual }) => {
  const [activeTab, setActiveTab] = useState<'tarot' | 'oracle' | 'practice'>('tarot');
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Deck State (Shared for Tarot & Oracle)
  const [deck, setDeck] = useState<any[]>(generateTarotDeck());
  const [isShuffling, setIsShuffling] = useState(false);
  const [hasShuffled, setHasShuffled] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isRevealing, setIsRevealing] = useState(false); 
  const [reading, setReading] = useState<TarotReading | null>(null);

  // Positioning State
  const deckScrollRef = useRef<HTMLDivElement>(null);
  
  // Practice State
  const [practice, setPractice] = useState<DailyPractice | null>(null);

  // Persistence Key Helper
  const getTodayKey = () => new Date().toLocaleDateString('zh-CN');

  // Load from LocalStorage on mount
  useEffect(() => {
      const todayKey = getTodayKey();
      const savedTarot = localStorage.getItem(`lucid_tarot_${todayKey}`);
      const savedOracle = localStorage.getItem(`lucid_oracle_${todayKey}`);
      const savedPractice = localStorage.getItem(`lucid_practice_${todayKey}`);

      let foundReading = false;

      // Priority: If Tarot exists, load Tarot (default tab). 
      // If only Oracle exists, switch to Oracle tab.
      if (savedTarot) {
          try {
              const parsed = JSON.parse(savedTarot);
              setReading(parsed);
              setHasShuffled(true);
              foundReading = true;
          } catch(e) { console.error(e) }
      } else if (savedOracle) {
          try {
              const parsed = JSON.parse(savedOracle);
              setReading(parsed);
              setHasShuffled(true);
              setActiveTab('oracle'); // Switch tab if only Oracle exists
              setDeck(generateOracleDeckState()); // Ensure deck is correct
              foundReading = true;
          } catch(e) { console.error(e) }
      }

      if (savedPractice) {
          try {
              setPractice(JSON.parse(savedPractice));
          } catch(e) { console.error(e) }
      }
  }, []);

  // Handle Tab Change
  const handleTabChange = (tabId: string) => {
      const newTab = tabId as 'tarot' | 'oracle' | 'practice';
      setActiveTab(newTab);
      
      const todayKey = getTodayKey();

      // Attempt to restore state for the specific tab
      if (newTab === 'tarot') {
          setDeck(generateTarotDeck());
          const savedTarot = localStorage.getItem(`lucid_tarot_${todayKey}`);
          if (savedTarot) {
              try {
                  setReading(JSON.parse(savedTarot));
                  setHasShuffled(true);
                  setIsShuffling(false);
                  setIsRevealing(false);
                  setSelectedIndices([]); // Or restore if we stored them, but reading is enough
              } catch(e) { resetState(); }
          } else {
              resetState();
          }
      } else if (newTab === 'oracle') {
          setDeck(generateOracleDeckState());
          const savedOracle = localStorage.getItem(`lucid_oracle_${todayKey}`);
          if (savedOracle) {
              try {
                  setReading(JSON.parse(savedOracle));
                  setHasShuffled(true);
                  setIsShuffling(false);
                  setIsRevealing(false);
                  setSelectedIndices([]);
              } catch(e) { resetState(); }
          } else {
              resetState();
          }
      }
      // 'practice' tab doesn't need deck state management, just view switching
  };

  const resetState = () => {
      setHasShuffled(false);
      setSelectedIndices([]);
      setReading(null);
      setIsRevealing(false);
      setIsShuffling(false);
      if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  // Auto-scroll to center of deck when shuffled
  useEffect(() => {
      if (hasShuffled && deckScrollRef.current) {
          const container = deckScrollRef.current;
          setTimeout(() => {
            container.scrollTo({
                left: (container.scrollWidth - container.clientWidth) / 2,
                behavior: 'smooth'
            });
          }, 300);
      }
  }, [hasShuffled]);

  // --- Handlers ---
  const handleShuffle = () => {
      setIsShuffling(true);
      setReading(null);
      setSelectedIndices([]);
      setIsRevealing(false);
      setPractice(null); 
      
      setTimeout(() => {
          const newDeck = [...deck];
          for (let i = newDeck.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
              
              // Only Tarot uses reversals
              if (activeTab === 'tarot') {
                  newDeck[i].isReversed = Math.random() > 0.5; 
              }
          }
          setDeck(newDeck);
          setIsShuffling(false);
          setHasShuffled(true);
      }, 1000);
  };

  const handleCardClick = async (index: number) => {
      const limit = activeTab === 'oracle' ? 1 : 3;
      if (selectedIndices.length >= limit || selectedIndices.includes(index) || isRevealing || loading) return;
      
      const newSelected = [...selectedIndices, index];
      setSelectedIndices(newSelected);

      if (newSelected.length === limit) {
          setIsRevealing(true); 
          setLoading(true);

          const drawnCards = newSelected.map((deckIndex, i) => ({
              name: deck[deckIndex].name,
              isReversed: deck[deckIndex].isReversed,
              keywords: deck[deckIndex].keywords || [],
              meaning: deck[deckIndex].meaning,
              description: deck[deckIndex].description,
              position: activeTab === 'oracle' ? 'oracle' : (i === 0 ? 'body' : i === 1 ? 'mind' : 'spirit')
          })) as any; 

          try {
              const minWaitPromise = new Promise(resolve => setTimeout(resolve, 2000));
              
              let apiPromise;
              if (activeTab === 'oracle') {
                  apiPromise = generateOracleReading(drawnCards, wishes);
              } else {
                  apiPromise = generateTarotReading(drawnCards, wishes);
              }
              
              const [_, generatedReading] = await Promise.all([minWaitPromise, apiPromise]);
              
              setReading(generatedReading);
              
              const todayKey = getTodayKey();
              const storageKey = activeTab === 'oracle' ? `lucid_oracle_${todayKey}` : `lucid_tarot_${todayKey}`;
              localStorage.setItem(storageKey, JSON.stringify(generatedReading));
              
              onSaveRitual({ date: Date.now(), reading: generatedReading });
              
              // --- COMBINED DAILY PRACTICE LOGIC ---
              let combinedContext = "";
              
              // Get the other reading if it exists
              const otherTab = activeTab === 'oracle' ? 'tarot' : 'oracle';
              const otherStorageKey = `lucid_${otherTab}_${todayKey}`;
              const savedOther = localStorage.getItem(otherStorageKey);
              
              let tarotContext = "";
              let oracleContext = "";

              if (activeTab === 'tarot') {
                  tarotContext = `[灵感塔罗]: ${generatedReading.guidance} (Cards: ${generatedReading.cards.map(c => c.name).join(', ')})`;
                  if (savedOther) {
                      try {
                          const otherReading = JSON.parse(savedOther);
                          oracleContext = `[神谕指引]: ${otherReading.guidance} (Cards: ${otherReading.cards.map((c: any) => c.name).join(', ')})`;
                      } catch(e) {}
                  }
              } else {
                  oracleContext = `[神谕指引]: ${generatedReading.guidance} (Cards: ${generatedReading.cards.map(c => c.name).join(', ')})`;
                  if (savedOther) {
                      try {
                          const otherReading = JSON.parse(savedOther);
                          tarotContext = `[灵感塔罗]: ${otherReading.guidance} (Cards: ${otherReading.cards.map((c: any) => c.name).join(', ')})`;
                      } catch(e) {}
                  }
              }
              
              if (tarotContext && oracleContext) {
                  combinedContext = `用户今天同时抽取了塔罗牌和神谕卡，请结合两者的指引生成今日练习。\n${tarotContext}\n${oracleContext}`;
              } else {
                  combinedContext = tarotContext || oracleContext;
              }

              generateDailyPractice(combinedContext).then(dp => {
                 setPractice(dp);
                 localStorage.setItem(`lucid_practice_${todayKey}`, JSON.stringify(dp));
                 onSaveRitual({ date: Date.now(), practice: dp });
              });

          } catch (error) {
              console.error("Reading failed", error);
          } finally {
              setLoading(false);
              setIsRevealing(false);
          }
      }
  };

  const resetTarot = () => {
      resetState();
      if (activeTab === 'oracle') {
          setDeck(generateOracleDeckState());
      } else {
          setDeck(generateTarotDeck());
      }
      localStorage.removeItem(activeTab === 'oracle' ? `lucid_oracle_${getTodayKey()}` : `lucid_tarot_${getTodayKey()}`);
      localStorage.removeItem(`lucid_practice_${getTodayKey()}`);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative w-full flex flex-col md:flex-row items-center justify-center min-h-[60px] mb-6 mt-2 shrink-0">
          <div className="w-full md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 md:w-auto z-0 pointer-events-none">
              <SectionTitle title="能量检查" subtitle="ENERGY · 频率校准" className="pr-4 md:pr-0" />
          </div>

          <div className="z-10 mt-4 md:mt-0">
              <TabNav 
                activeTab={activeTab}
                onTabChange={handleTabChange}
                tabs={[
                    { id: 'tarot', icon: CreditCard, label: '灵感塔罗' },
                    { id: 'oracle', icon: Sparkles, label: '神谕指引' },
                    { id: 'practice', icon: Sun, label: '今日练习' },
                ]}
              />
          </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-20 no-scrollbar animate-fade-in relative flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
            {/* 1. TAROT & ORACLE VIEW */}
            {(activeTab === 'tarot' || activeTab === 'oracle') && (
            <div key={activeTab} className="flex flex-col items-center flex-1 animate-fade-in">
                
                {/* Initial State: Prompt Shuffle */}
                {!hasShuffled && !loading && !reading && (
                    <div className="flex flex-col items-center justify-center space-y-6 flex-1 animate-fade-in min-h-[400px]">
                        <div className="relative group cursor-pointer" onClick={handleShuffle}>
                            <div className={`w-48 h-72 bg-gradient-to-br ${activeTab === 'oracle' ? 'from-stone-800 to-stone-900' : 'from-stone-800 to-stone-900'} border border-white/20 rounded-2xl flex items-center justify-center shadow-2xl relative z-10 transition-transform duration-500 group-hover:-translate-y-2`}>
                                <div className="text-center">
                                    <Shuffle className={`w-10 h-10 text-lucid-glow mx-auto mb-3 ${isShuffling ? 'animate-spin' : ''}`} />
                                    <h3 className="text-xl font-serif text-white tracking-widest">一键洗牌</h3>
                                    <p className="text-xs text-lucid-dim mt-2 tracking-wider opacity-60">
                                        {activeTab === 'oracle' ? '52 Cards Deck' : '78 Cards Deck'}
                                    </p>
                                </div>
                            </div>
                            <div className="absolute top-2 left-2 w-48 h-72 bg-stone-800/50 rounded-2xl border border-white/10 -z-10"></div>
                            <div className="absolute top-4 left-4 w-48 h-72 bg-stone-800/30 rounded-2xl border border-white/5 -z-20"></div>
                        </div>
                        <p className="text-stone-400 font-serif italic text-sm">
                            {activeTab === 'oracle' ? '点击洗牌，连接宇宙神谕...' : '点击洗牌，注入你的能量...'}
                        </p>
                    </div>
                )}


                {isShuffling && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-3xl">
                        <LoadingSpinner />
                    </div>
                )}

                {hasShuffled && !reading && (
                    <div className="w-full animate-fade-in mt-4 flex flex-col items-center relative">
                        
                        <div className={`text-center mb-4 transition-opacity duration-500 ${isRevealing ? 'opacity-0' : 'opacity-100'}`}>
                            <h3 className="text-xl font-serif text-white">请凭直觉抽取{activeTab === 'oracle' ? '一张' : '三张'}牌</h3>
                            <p className="text-lucid-dim text-sm mt-1">{selectedIndices.length} / {activeTab === 'oracle' ? 1 : 3} 已选择</p>
                            <div className="flex items-center justify-center gap-2 mt-2 opacity-50">
                                <MoveHorizontal className="w-3 h-3 text-stone-400 animate-pulse" />
                                <p className="text-stone-400 text-[10px] font-sans tracking-widest">
                                    左右滑动以查看所有牌
                                </p>
                                <MoveHorizontal className="w-3 h-3 text-stone-400 animate-pulse" />
                            </div>
                        </div>
                        
                        <div ref={deckScrollRef} className="w-full overflow-x-auto overflow-y-visible no-scrollbar pb-32 pt-48 pl-32 pr-8 min-h-[500px]">
                            <div className="flex items-end min-w-max h-40 relative mx-auto" style={{ marginLeft: '-1rem' }}> 
                                {deck.map((card, idx) => {
                                    const isSelected = selectedIndices.includes(idx);
                                    const selectedOrder = selectedIndices.indexOf(idx); 
                                    
                                    const centerIndex = Math.floor(deck.length / 2);
                                    const distFromCenter = idx - centerIndex;
                                    
                                    const arcLift = 80;
                                    const yDrop = Math.pow(Math.abs(distFromCenter), 2) / 12;
                                    const normalTranslateY = -1 * arcLift + yDrop;
                                    const normalRotate = distFromCenter * 1.1;

                                    let style: React.CSSProperties = {};

                                    if (isRevealing) {
                                        if (isSelected) {
                                            const offsetX = activeTab === 'oracle' ? 0 : (selectedOrder - 1) * 140; 
                                            style = {
                                                position: 'fixed',
                                                top: '50%',
                                                left: '50%',
                                                transform: `translate(calc(-50% + ${offsetX}px), -50%) scale(1.1) rotate(0deg)`,
                                                zIndex: 1000,
                                                opacity: 1,
                                                transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                marginLeft: 0,
                                                pointerEvents: 'none'
                                            };
                                        } else {
                                            style = {
                                                transform: `translateY(${normalTranslateY}px) rotate(${normalRotate}deg) scale(0.8)`,
                                                opacity: 0,
                                                transition: 'all 0.5s ease-out',
                                                pointerEvents: 'none'
                                            };
                                        }
                                    } else {
                                        style = {
                                            transform: isSelected 
                                                ? `translateY(-120px) rotate(0deg) scale(1.1)` 
                                                : `translateY(${normalTranslateY}px) rotate(${normalRotate}deg)`,
                                            zIndex: isSelected ? 100 : 80 - Math.abs(distFromCenter),
                                            opacity: 1,
                                            position: 'relative'
                                        };
                                    }

                                    return (
                                        <div 
                                            key={card.id}
                                            onClick={() => handleCardClick(idx)}
                                            style={{ 
                                                ...style,
                                                // Only apply negative margin if NOT revealing/selected
                                                marginLeft: (isRevealing && isSelected) ? 0 : (idx === 0 ? '0' : '-1.8rem'),
                                            }}
                                            className={`
                                                w-16 h-28 md:w-24 md:h-36 rounded-xl border border-white/20 cursor-pointer shadow-xl transition-all duration-300 origin-bottom
                                                ${!isRevealing && !isSelected ? 'hover:z-[99] hover:-translate-y-16 hover:scale-110 hover:shadow-[0_0_30px_rgba(253,186,116,0.5)] hover:bg-stone-700/80 hover:border-lucid-glow/50' : ''}
                                                ${activeTab === 'oracle' ? 'bg-stone-800' : 'bg-stone-800'} 
                                                flex-shrink-0 relative overflow-hidden
                                                ${isSelected ? 'ring-2 ring-lucid-glow shadow-[0_0_20px_rgba(253,186,116,0.3)] bg-stone-700' : ''}
                                            `}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                                            <div className={`w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${activeTab === 'oracle' ? 'from-orange-900 to-black' : 'from-orange-900 to-black'}`}></div>
                                            <div className="absolute inset-2 border border-white/5 rounded-md opacity-50"></div>
                                            
                                            {/* Oracle Card Label on Back (Optional) */}
                                            {activeTab === 'oracle' && !isRevealing && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                                    <Sparkles className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {loading && (
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 translate-y-24 z-[1001] flex flex-col items-center pointer-events-none w-full">
                                <LoadingSpinner />
                                <p className="text-lucid-dim font-serif mt-3 text-sm tracking-widest animate-pulse drop-shadow-md bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm">
                                    连接潜意识频率...
                                </p>
                            </div>
                        )}
                    </div>
                )}
                
                {reading && (
                    <div className="w-full space-y-10 animate-fade-in pb-10">
                        <div className="flex flex-col md:flex-row justify-center gap-6 mt-4">
                            {reading.cards.map((card, idx) => (
                                <div key={idx} className={`relative w-full ${activeTab === 'oracle' ? 'md:w-80 h-[32rem]' : 'md:w-56 h-[26rem]'} group perspective-1000 animate-fade-in`} style={{animationDelay: `${idx * 0.2}s`}}>
                                    <div className={`relative w-full h-full bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-5 flex flex-col items-center shadow-2xl transition-all duration-700 ${card.isReversed ? 'rotate-180' : ''}`}>
                                        
                                        <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-30 mix-blend-overlay">
                                            <div className={`w-full h-full bg-gradient-to-b ${activeTab === 'oracle' ? 'from-stone-700 to-black' : 'from-stone-700 to-black'}`}></div>
                                        </div>
                                        
                                        <div className={`${card.isReversed ? 'rotate-180' : ''} flex flex-col items-center z-10 relative h-full w-full justify-start`}>
                                            <span className="text-xs uppercase tracking-[0.2em] text-lucid-glow opacity-80 border border-lucid-glow/30 px-3 py-1 rounded-full bg-black/20 flex-shrink-0">
                                                {card.position === 'oracle' ? 'Oracle Message' : card.position}
                                            </span>
                                            <div className="my-3 text-center flex-shrink-0">
                                                <h4 className="text-xl font-serif text-white mb-2">{safeRender(card.name)}</h4>
                                                {activeTab === 'tarot' && (
                                                    card.isReversed ? (
                                                        <span className="text-xs text-rose-300 uppercase tracking-widest font-sans opacity-90">逆位 Reversed</span>
                                                    ) : (
                                                        <span className="text-xs text-emerald-300 uppercase tracking-widest font-sans opacity-90">正位 Upright</span>
                                                    )
                                                )}
                                                {activeTab === 'oracle' && (
                                                    <span className="text-xs text-purple-300 uppercase tracking-widest font-sans opacity-90">
                                                        <Sparkles className="w-3 h-3 inline mr-1" />
                                                        Oracle Message
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-full flex-grow flex items-start mt-2 px-2">
                                                <p className="text-sm text-stone-100 font-serif leading-relaxed text-justify">
                                                    {safeRender(card.meaning)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="max-w-2xl mx-auto space-y-4">
                            <Card className="bg-gradient-to-b from-white/5 to-transparent border-t border-white/10">
                                <h4 className="text-lg font-serif text-lucid-glow mb-4 text-center">✨ 宇宙讯息</h4>
                                <p className="text-stone-200 font-serif leading-loose text-justify text-sm md:text-base">
                                    {safeRender(reading.guidance)}
                                </p>
                                <div className="mt-6 pt-4 border-t border-white/5 flex flex-col items-center">
                                    <span className="text-xs text-stone-500 uppercase tracking-widest mb-1">今日宜显化 · Focus Wish</span>
                                    <p className="text-white font-serif text-base">{safeRender(reading.focusWishName) || "当下"}</p>
                                </div>
                            </Card>

                            <div className="flex justify-center pt-2">
                                <Button onClick={resetTarot} variant="ghost" className="text-sm text-stone-500 hover:text-white">
                                    <RotateCcw className="w-4 h-4 mr-2" /> 开启新的解读
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}

            {/* 2. DAILY PRACTICE (Dependant on Tarot) */}
            {activeTab === 'practice' && (
            <div className="max-w-xl mx-auto py-6 animate-fade-in">
                {!practice ? (
                    <div className="text-center space-y-4 py-16 flex flex-col items-center">
                        <Sun className="w-12 h-12 text-stone-600 opacity-50" />
                        <div>
                            <h3 className="text-lg font-serif text-stone-300">今日能量未激活</h3>
                            <p className="text-stone-500 text-sm mt-1">请先进行“灵感塔罗”或“神谕指引”抽取，以获取专属指引。</p>
                        </div>
                        <Button onClick={() => setActiveTab('tarot')} variant="outline" className="rounded-full px-8 text-xs">
                            前往抽取
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Card className="text-center relative overflow-hidden group py-10">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-lucid-glow to-transparent opacity-50"></div>
                            <span className="text-xs font-sans tracking-widest text-stone-500 uppercase">今日能量场</span>
                            <h2 className="text-3xl font-serif text-white mt-2 mb-6">{safeRender(practice.energyStatus)}</h2>
                            
                            <div className="w-12 h-[1px] bg-white/10 mx-auto mb-6"></div>
                            
                            <span className="text-xs font-sans tracking-widest text-lucid-accent/80 uppercase block mb-2">今日肯定语</span>
                            <p className="text-xl text-lucid-glow font-serif italic opacity-90 px-4">
                                "{safeRender(practice.todaysAffirmation)}"
                            </p>
                        </Card>

                        <Card className="flex items-start gap-4">
                            <div className="p-2 bg-emerald-900/20 rounded-full text-emerald-400 mt-1">
                                <Sun className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-emerald-100 mb-1">今日微行动</h4>
                                <p className="text-stone-300 font-serif leading-relaxed text-base">
                                    {safeRender(practice.actionStep)}
                                </p>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default EnergyCheckView;
