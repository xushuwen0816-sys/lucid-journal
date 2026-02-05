import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface SentimentDataPoint {
  dateStr: string;
  timestamp: number;
  score: number; // 1-10
  emotions: string[];
}

interface SentimentTrendChartProps {
  data: SentimentDataPoint[];
  onPointClick?: (point: SentimentDataPoint) => void;
  height?: number | string;
  showXAxis?: boolean;
  showGrid?: boolean;
  gradientId?: string;
  lineColor?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as SentimentDataPoint;
    return (
      <div className="bg-stone-900/95 border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md z-50">
        <p className="text-stone-200 font-serif text-sm mb-1">{data.dateStr}</p>
        <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-stone-400">能量指数:</span>
            <span className="text-lucid-glow font-bold text-lg">{data.score.toFixed(1)}</span>
        </div>
        {data.emotions.length > 0 && (
            <div className="flex flex-wrap gap-1 max-w-[200px]">
                {data.emotions.slice(0, 5).map((e, i) => (
                    <span key={i} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-stone-300">
                        {e}
                    </span>
                ))}
            </div>
        )}
      </div>
    );
  }
  return null;
};

const SentimentTrendChart: React.FC<SentimentTrendChartProps> = ({ 
  data, 
  onPointClick,
  height = "100%",
  showXAxis = true,
  showGrid = true,
  gradientId = "colorScore",
  lineColor = "#FDBA74"
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full min-h-[100px]">
        <p className="text-stone-600 text-xs italic">暂无数据</p>
      </div>
    );
  }

  return (
    <div style={{ height: height, width: '100%' }}>
      <style>{`
        .recharts-surface:focus,
        .recharts-wrapper:focus,
        .recharts-dot:focus,
        div.recharts-wrapper:focus,
        svg.recharts-surface:focus,
        g:focus,
        path:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          onClick={(e) => {
             if (e && e.activePayload && e.activePayload.length > 0 && onPointClick) {
                 onPointClick(e.activePayload[0].payload);
             }
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />}
          {showXAxis && (
              <XAxis 
                dataKey="dateStr" 
                stroke="#78716C" 
                tick={{ fontSize: 10 }} 
                tickMargin={10}
                interval="preserveStartEnd"
                tickFormatter={(val) => {
                    // Assuming val is "YYYY-MM-DD", return "MM-DD"
                    const parts = val.split('-');
                    if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
                    return val;
                }}
              />
          )}
          <YAxis 
            hide={!showGrid} 
            domain={[0, 10]} 
            ticks={[0, 2, 4, 6, 8, 10]}
            allowDecimals={false}
            stroke="#78716C" 
            tick={{ fontSize: 10 }}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} isAnimationActive={false} />
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke={lineColor} 
            fillOpacity={1} 
            fill={`url(#${gradientId})`} 
            strokeWidth={2}
            activeDot={{ 
                r: 6, 
                strokeWidth: 0, 
                fill: '#fff', 
                style: { cursor: 'pointer' },
                onClick: (e: any, payload: any) => {
                    // Recharts passes (props, event) or (data, index, event) depending on version
                    // Safe access to payload
                    const p = payload?.payload || e?.payload; 
                    if (onPointClick && p) {
                        onPointClick(p);
                    }
                }
            }}
            onClick={(data: any) => {
                // Handle click on the line/area itself if needed, but usually activeDot is enough
                // 'data' here might be the full series data or event depending on version
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SentimentTrendChart;
