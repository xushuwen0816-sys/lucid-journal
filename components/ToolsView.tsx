
import React, { useState, useEffect } from 'react';
import { Wish } from '../types';
import { Type, Filter } from 'lucide-react';
import { Card, SectionTitle } from './Shared';
import { useTheme } from '../contexts/ThemeContext';

interface ToolsViewProps {
  wish: Wish;
  wishes?: Wish[]; 
  onUpdateWish: (updatedWish: Wish) => void;
}

const ToolsView: React.FC<ToolsViewProps> = ({ wish, wishes = [], onUpdateWish }) => {
  // Wish Selection State
  const [selectedWishId, setSelectedWishId] = useState<string>(wish.id);
  // Affirmation View Mode - Default to ALL
  const [affirmationViewMode, setAffirmationViewMode] = useState<'all' | 'single'>('all');

  // Sync if external wish prop changes drastically
  useEffect(() => {
    if (wishes.length > 0 && !wishes.find(w => w.id === selectedWishId)) {
        setSelectedWishId(wish.id);
    }
  }, [wish.id, wishes]);

  const { isLightMode } = useTheme();

  const targetWish = wishes.find(w => w.id === selectedWishId) || wish;

  return (
    <div className="w-full h-full flex flex-col relative">
        <SectionTitle title="能量语库" subtitle="AFFIRMATIONS · 肯定语" />

        <div className="flex-1 overflow-y-auto px-4 pb-32 custom-scrollbar animate-fade-in">
             <div className="max-w-2xl mx-auto space-y-6 pt-4">
                 <div className="space-y-4">
                     <div className={`flex justify-between items-center mb-4 border-b pb-4 ${isLightMode ? 'border-stone-200' : 'border-white/5'}`}>
                         <div className="flex items-center gap-2">
                            <Type className={`w-4 h-4 ${isLightMode ? 'text-orange-500' : 'text-lucid-glow'}`} />
                            <h3 className={`font-serif text-base ${isLightMode ? 'text-stone-800' : 'text-white'}`}>肯定语库 Library</h3>
                         </div>
                         
                         {/* View Mode Toggle */}
                         <div className={`rounded-lg p-1 flex text-xs ${isLightMode ? 'bg-stone-100' : 'bg-white/5'}`}>
                            <button 
                                onClick={() => setAffirmationViewMode('all')} 
                                className={`px-3 py-1 rounded-md transition-all ${affirmationViewMode === 'all' ? (isLightMode ? 'bg-white text-stone-800 shadow-sm' : 'bg-white/10 text-white shadow-sm') : 'text-stone-500 hover:text-stone-400'}`}
                            >
                                全部
                            </button>
                            <button 
                                onClick={() => setAffirmationViewMode('single')} 
                                className={`px-3 py-1 rounded-md transition-all ${affirmationViewMode === 'single' ? (isLightMode ? 'bg-white text-stone-800 shadow-sm' : 'bg-white/10 text-white shadow-sm') : 'text-stone-500 hover:text-stone-400'}`}
                            >
                                筛选
                            </button>
                         </div>
                     </div>
                     
                     {affirmationViewMode === 'single' && (
                         <div className={`text-xs mb-2 flex items-center gap-1 p-2 rounded-lg ${isLightMode ? 'bg-stone-50 text-stone-600' : 'bg-white/5 text-stone-500'}`}>
                             <Filter className="w-3 h-3" /> 
                             <span className="opacity-70">筛选对象:</span>
                             <select 
                                 value={selectedWishId}
                                 onChange={(e) => setSelectedWishId(e.target.value)}
                                 className={`bg-transparent border-none focus:ring-0 text-xs font-serif cursor-pointer outline-none ${isLightMode ? 'text-orange-600' : 'text-lucid-glow'}`}
                             >
                                 {wishes.map(w => <option key={w.id} value={w.id}>{w.content.slice(0, 15)}...</option>)}
                             </select>
                         </div>
                     )}

                     <div className="space-y-8">
                        {(affirmationViewMode === 'all' ? wishes : [targetWish]).map((w) => (
                            <div key={w.id} className="animate-fade-in">
                                {/* Section Header if in 'All' mode */}
                                {affirmationViewMode === 'all' && (
                                    <div className="flex items-center gap-2 mb-3 pl-1 mt-6 first:mt-0">
                                        <div className={`w-1 h-3 rounded-full ${isLightMode ? 'bg-orange-400' : 'bg-lucid-glow/50'}`}></div>
                                        <h4 className={`text-xs font-bold uppercase tracking-widest truncate max-w-[80%] ${isLightMode ? 'text-stone-500' : 'text-stone-400'}`}>{w.content}</h4>
                                    </div>
                                )}
                                
                                <div className="grid gap-3">
                                    {w.affirmations.map((aff, i) => (
                                        <Card key={`${w.id}-${i}`} className={`flex gap-4 items-start group transition-colors p-4 ${isLightMode ? 'bg-white/40 hover:bg-orange-50/80 border-stone-200' : 'hover:bg-white/5 border-white/5'}`}>
                                            <div className="flex-1">
                                                <span className={`text-[9px] uppercase tracking-widest block mb-1.5 font-sans ${
                                                    aff.type === 'conscious' ? (isLightMode ? 'text-orange-600' : 'text-orange-300/80') : aff.type === 'subconscious' ? (isLightMode ? 'text-rose-600' : 'text-rose-300/80') : (isLightMode ? 'text-emerald-600' : 'text-emerald-300/80')
                                                }`}>
                                                    {aff.type === 'conscious' ? '显意识 Conscious' : aff.type === 'subconscious' ? '潜意识 Subconscious' : '未来 Future Self'}
                                                </span>
                                                <p className={`font-serif leading-relaxed text-sm ${isLightMode ? 'text-stone-800' : 'text-stone-200'}`}>"{aff.text}"</p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {wishes.length === 0 && <p className={`text-center text-sm py-10 ${isLightMode ? 'text-stone-400' : 'text-stone-500'}`}>暂无数据</p>}
                     </div>
                 </div>
             </div>
        </div>
    </div>
  );
};

export default ToolsView;