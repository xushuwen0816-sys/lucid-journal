import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Modal } from './Shared';

interface StatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: { name: string; count: number }[]; // Ensure 'count' is used or mapped to 'value'
  color?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-stone-900/95 border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md z-50">
        <p className="text-stone-200 font-serif text-sm mb-1">{label}</p>
        <p className="text-xs text-stone-400">
          频次: <span className="text-white font-bold">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const StatDetailModal: React.FC<StatDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
  color = '#FDBA74'
}) => {
  // Sort data by count descending
  const sortedData = [...data].sort((a, b) => b.count - a.count);
  
  // Calculate dynamic height based on number of items (approx 40px per item)
  // Ensure minimum height to fit container or let it scroll if content is larger
  const chartHeight = Math.max(260, sortedData.length * 40);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="w-full h-[400px] overflow-y-auto custom-scrollbar bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        {sortedData.length === 0 ? (
          <p className="text-center text-stone-500 py-10">暂无数据记录</p>
        ) : (
          <div style={{ height: chartHeight, width: '100%' }}>
            <style>{`
              .recharts-wrapper, 
              .recharts-surface, 
              .recharts-rectangle,
              div.recharts-wrapper:focus,
              svg.recharts-surface:focus,
              g:focus,
              path:focus {
                outline: none !important;
                box-shadow: none !important;
              }
            `}</style>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={sortedData}
                margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  type="number" 
                  stroke="#78716C" 
                  tick={{ fontSize: 10 }} 
                  allowDecimals={false}
                  domain={[0, 'auto']}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  stroke="#78716C" 
                  tick={{ fontSize: 11, fill: '#A8A29E' }}
                  interval={0}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} isAnimationActive={false} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={color} fillOpacity={0.8 - (index * 0.01)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default StatDetailModal;
