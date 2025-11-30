
import React, { useState, useEffect } from 'react';
import { Wish } from '../types';
import { Type, Filter } from 'lucide-react';
import { Card, SectionTitle } from './Shared';

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

  const targetWish = wishes.find(w => w.id === selectedWishId) || wish;

  return (
    <div className="w-full h-full flex flex-col relative">
        <SectionTitle title="能量语库" subtitle="AFFIRMATIONS · 肯定语" />

        <div className="flex-1 overflow-y-auto px-4 pb-32 custom-scrollbar animate-fade-in">
             <div className="max-w-2xl mx-auto space-y-6 pt-4">
                 <div className="space-y-4">
                     <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                         <div className="flex items-center gap-2">
                            <Type className="w-4 h-4 text-lucid-glow" />
                            <h3 className="text-white font-serif text-base">肯定语库 Library</h3>
                         </div>
                         
                         {/* View Mode Toggle */}
                         <div className="bg-white/5 rounded-lg p-1 flex text-xs">
                            <button 
                                onClick={() => setAffirmationViewMode('all')} 
                                className={`px-3 py-1 rounded-md transition-all ${affirmationViewMode === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                            >
                                全部
                            </button>
                            <button 
                                onClick={() => setAffirmationViewMode('single')} 
                                className={`px-3 py-1 rounded-md transition-all ${affirmationViewMode === 'single' ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                            >
                                筛选
                            </button>
                         </div>
                     </div>
                     
                     {affirmationViewMode === 'single' && (
                         <div className="text-xs text-stone-500 mb-2 flex items-center gap-1 bg-white/5 p-2 rounded-lg">
                             <Filter className="w-3 h-3" /> 
                             <span className="opacity-70">筛选对象:</span>
                             <select 
                                 value={selectedWishId}
                                 onChange={(e) => setSelectedWishId(e.target.value)}
                                 className="bg-transparent text-lucid-glow border-none focus:ring-0 text-xs font-serif cursor-pointer outline-none"
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
                                        <div className="w-1 h-3 bg-lucid-glow/50 rounded-full"></div>
                                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest truncate max-w-[80%]">{w.content}</h4>
                                    </div>
                                )}
                                
                                <div className="grid gap-3">
                                    {w.affirmations.map((aff, i) => (
                                        <Card key={`${w.id}-${i}`} className="flex gap-4 items-start group hover:bg-white/5 transition-colors p-4 border-white/5">
                                            <div className="flex-1">
                                                <span className={`text-[9px] uppercase tracking-widest block mb-1.5 font-sans ${
                                                    aff.type === 'conscious' ? 'text-orange-300/80' : aff.type === 'subconscious' ? 'text-rose-300/80' : 'text-emerald-300/80'
                                                }`}>
                                                    {aff.type === 'conscious' ? '显意识 Conscious' : aff.type === 'subconscious' ? '潜意识 Subconscious' : '未来 Future Self'}
                                                </span>
                                                <p className="text-stone-200 font-serif leading-relaxed text-sm">"{aff.text}"</p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {wishes.length === 0 && <p className="text-center text-stone-500 text-sm py-10">暂无数据</p>}
                     </div>
                 </div>
             </div>
        </div>
    </div>
  );
};

export default ToolsView;