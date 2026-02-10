import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

interface StatPieChartProps {
  data: { name: string; value: number }[];
  colors?: string[];
  innerRadius?: number;
  outerRadius?: number;
}

const DEFAULT_COLORS = [
  '#F4A261', // Soft Orange
  '#E76F51', // Terracotta
  '#2A9D8F', // Teal
  '#E9C46A', // Soft Yellow
  '#8ECAE6', // Light Blue
  '#FFB5A7', // Pastel Pink
  '#B5838D', // Old Rose
  '#6D597A', // Muted Purple
  '#B7B7A4', // Sage Green
  '#D4A373', // Beige
];

const CustomTooltip = ({ active, payload }: any) => {
  const { isLightMode } = useTheme();
  
  if (active && payload && payload.length) {
    return (
      <div className={`${isLightMode ? 'bg-white/90 border-stone-200 text-stone-800' : 'bg-stone-900/90 border-white/10 text-stone-200'} border p-3 rounded-xl shadow-2xl backdrop-blur-md z-50 flex flex-col items-center justify-center min-w-[100px]`}>
        <p className={`${isLightMode ? 'text-stone-600' : 'text-stone-200'} font-serif text-xs whitespace-nowrap mb-1 text-center`}>
        {payload[0].name}
        </p>
        <p className={`${isLightMode ? 'text-orange-500' : 'text-lucid-glow'} font-bold text-xl`}>{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

const StatPieChart: React.FC<StatPieChartProps> = ({ 
  data, 
  colors = DEFAULT_COLORS,
  innerRadius = 45,
  outerRadius = 65
}) => {
  const { isLightMode } = useTheme();
  
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full min-h-[160px]">
        <p className={`text-xs italic ${isLightMode ? 'text-stone-400' : 'text-stone-500'}`}>暂无数据</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[240px] relative">
      <style>{`
        .recharts-wrapper, 
        .recharts-surface, 
        .recharts-sector, 
        .recharts-layer,
        div.recharts-wrapper:focus,
        svg.recharts-surface:focus,
        g:focus,
        path:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
            cornerRadius={2}
            labelLine={{ stroke: isLightMode ? '#d6d3d1' : '#78716c', strokeWidth: 1 }}
            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value, x, y, fill }) => {
                const textAnchor = x > cx ? 'start' : 'end';
                
                return (
                    <text 
                        x={x} 
                        y={y} 
                        fill={isLightMode ? '#57534e' : '#a8a29e'}
                        textAnchor={textAnchor} 
                        dominantBaseline="central" 
                        className="text-[10px] font-serif tracking-wide"
                    >
                        {name}
                    </text>
                );
            }}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors[index % colors.length]} 
                className="outline-none hover:opacity-80 transition-opacity duration-300 cursor-pointer"
                strokeWidth={0}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} isAnimationActive={false} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StatPieChart;
