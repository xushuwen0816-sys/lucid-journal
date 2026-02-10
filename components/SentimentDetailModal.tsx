import React, { useState, useMemo } from 'react';
import { Modal } from './Shared';
import SentimentTrendChart, { SentimentDataPoint } from './SentimentTrendChart';
import { JournalEntry } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface SentimentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  onDateSelect: (date: Date) => void;
}

type TimeRange = '30d' | '3mo' | '1y' | 'all';

// Helper to calculate score
const getSentimentScore = (emotion: string): number => {
    const map: Record<string, number> = {
        'joy': 9, 'happy': 8, 'excited': 8, 'grateful': 9, 'peaceful': 7, 'calm': 7, 'hopeful': 8, 'confident': 9,
        'inspired': 9, 'love': 10, 'content': 7, 'proud': 8, 'relieved': 7,
        'neutral': 5, 'okay': 5,
        'tired': 4, 'bored': 4, 'confused': 4, 'anxious': 3, 'sad': 3, 'angry': 2, 'frustrated': 3, 'overwhelmed': 2,
        'lonely': 2, 'guilty': 2, 'ashamed': 1, 'hopeless': 1, 'fear': 2,
        // Chinese translations
        '喜悦': 9, '快乐': 8, '兴奋': 8, '感恩': 9, '平静': 7, '安宁': 7, '希望': 8, '自信': 9,
        '灵感': 9, '爱': 10, '满足': 7, '自豪': 8, '释然': 7,
        '平淡': 5, '还好': 5,
        '疲惫': 4, '无聊': 4, '困惑': 4, '焦虑': 3, '悲伤': 3, '愤怒': 2, '挫败': 3, '压力': 2,
        '孤独': 2, '内疚': 2, '羞愧': 1, '绝望': 1, '恐惧': 2, '烦躁': 3, '自我批评': 2
    };
    
    const lower = emotion.toLowerCase();
    if (map[lower]) return map[lower];
    for (const key in map) {
        if (lower.includes(key)) return map[key];
    }
    return 5; 
};

export const processSentimentData = (entries: JournalEntry[], days?: number): SentimentDataPoint[] => {
    const map: Record<string, { sum: number, count: number, emotions: Set<string>, timestamp: number }> = {};
    
    const now = Date.now();
    const cutoff = days ? now - (days * 24 * 60 * 60 * 1000) : 0;

    entries.forEach(e => {
        if (e.date < cutoff) return;
        
        const dateObj = new Date(e.date);
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
        
        if (!map[dateStr]) {
            map[dateStr] = { sum: 0, count: 0, emotions: new Set(), timestamp: dateObj.getTime() };
        }
        
        // Extract emotions
        let emotions: string[] = [];
        if (e.aiAnalysis?.emotionalState) {
            const raw = e.aiAnalysis.emotionalState;
            if (Array.isArray(raw)) {
                emotions = raw.map((item: any) => typeof item === 'object' ? item.text || '' : String(item)).filter(Boolean);
            } else if (typeof raw === 'string') {
                emotions = [raw];
            }
        }
        
        // Calculate average score for this entry
        let entrySum = 0;
        if (emotions.length > 0) {
            emotions.forEach(em => {
                entrySum += getSentimentScore(em);
                map[dateStr].emotions.add(em);
            });
            map[dateStr].sum += (entrySum / emotions.length);
            map[dateStr].count += 1;
        } else {
             // Default neutral if no emotions found but entry exists
             map[dateStr].sum += 5;
             map[dateStr].count += 1;
        }
    });
    
    return Object.entries(map).map(([dateStr, val]) => ({
        dateStr,
        timestamp: val.timestamp,
        score: val.sum / val.count,
        emotions: Array.from(val.emotions)
    })).sort((a, b) => a.timestamp - b.timestamp);
};

const SentimentDetailModal: React.FC<SentimentDetailModalProps> = ({
  isOpen,
  onClose,
  entries,
  onDateSelect
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const { isLightMode } = useTheme();

  const chartData = useMemo(() => {
      let days = 30;
      if (timeRange === '30d') days = 30;
      if (timeRange === '3mo') days = 90;
      if (timeRange === '1y') days = 365;
      if (timeRange === 'all') days = 0;
      
      return processSentimentData(entries, days);
  }, [entries, timeRange]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="情绪流动分析 · Emotional Flow">
      <div className="space-y-6">
        {/* Filter Controls */}
        <div className="flex justify-center">
            <div className={`p-1 rounded-xl flex gap-1 ${isLightMode ? 'bg-stone-100' : 'bg-white/5'}`}>
                {(['30d', '3mo', '1y', 'all'] as TimeRange[]).map((range) => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`
                            px-4 py-1.5 rounded-lg text-xs font-serif transition-all
                            ${timeRange === range 
                                ? (isLightMode ? 'bg-white text-orange-600 shadow-sm font-bold border border-stone-200' : 'bg-lucid-glow text-stone-900 shadow-lg shadow-lucid-glow/20 font-bold') 
                                : (isLightMode ? 'text-stone-500 hover:text-stone-800 hover:bg-white/50' : 'text-stone-400 hover:text-stone-200 hover:bg-white/5')}
                        `}
                    >
                        {range === '30d' ? '30天' : range === '3mo' ? '3个月' : range === '1y' ? '1年' : '全部'}
                    </button>
                ))}
            </div>
        </div>

        {/* Chart */}
        <div className={`h-[300px] w-full border rounded-2xl p-4 ${isLightMode ? 'bg-white/40 border-stone-200' : 'bg-white/[0.02] border-white/5'}`}>
             <SentimentTrendChart 
                data={chartData} 
                onPointClick={(point) => {
                    onDateSelect(new Date(point.timestamp));
                }}
                lineColor={isLightMode ? '#F97316' : '#FDBA74'}
             />
        </div>
        
        <div className="text-center">
            <p className={`text-xs font-serif italic ${isLightMode ? 'text-stone-400' : 'text-stone-500'}`}>
                * 点击折线图上的节点可跳转至当天的日记详情
            </p>
        </div>
      </div>
    </Modal>
  );
};

export default SentimentDetailModal;
