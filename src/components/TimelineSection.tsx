import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';

interface Activity {
  id: string;
  date: string;
  title: string;
  description: string;
  summary?: string;
  type: 'planting' | 'fertilizing' | 'harvesting' | 'other';
}

const mockActivities: Activity[] = [
  { id: '1', date: '2026-04-15', title: '施肥', description: '全区域施用氮肥，促进作物生长。', summary: '用量：50kg/亩', type: 'fertilizing' },
  { id: '2', date: '2026-03-10', title: '播种', description: '完成A区玉米种子播种工作。', type: 'planting' },
  { id: '3', date: '2025-10-20', title: '秋收', description: '完成2025年度玉米收割。', summary: '亩产：800kg', type: 'harvesting' },
  { id: '4', date: '2025-04-10', title: '施肥', description: '春季追肥。', type: 'fertilizing' },
  { id: '5', date: '2025-03-05', title: '播种', description: '2025年度玉米播种。', type: 'planting' },
];

export const TimelineSection: React.FC = () => {
  // 动态计算数据包含的年份，并降序排列
  const years = useMemo(() => {
    const y = Array.from(new Set(mockActivities.map(a => new Date(a.date).getFullYear())));
    return y.sort((a, b) => b - a);
  }, []);

  const [selectedYear, setSelectedYear] = useState<number>(years[0] || new Date().getFullYear());

  // 根据选择的年份过滤数据，并按时间倒序排列
  const filteredActivities = useMemo(() => {
    return mockActivities
      .filter(a => new Date(a.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedYear]);

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'planting': return 'bg-emerald-500';
      case 'fertilizing': return 'bg-blue-500';
      case 'harvesting': return 'bg-amber-500';
      default: return 'bg-zinc-400';
    }
  };

  return (
    <section className="farm-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-zinc-800">农事行为</h2>
        
        {/* 年份筛选器 (仅在有多年的数据时显示) */}
        {years.length > 1 && (
          <div className="relative">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-zinc-100 border border-zinc-200 text-zinc-700 py-1.5 pl-3 pr-8 rounded-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
          </div>
        )}
      </div>

      {filteredActivities.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 text-sm">暂无该年度农事记录</div>
      ) : (
        <div className="relative border-l-2 border-zinc-100 ml-2">
          {filteredActivities.map((activity, index) => (
            <div key={activity.id} className={`${index === filteredActivities.length - 1 ? '' : 'mb-8'} ml-6 relative`}>
              <div className={`absolute -left-[33px] top-1 w-4 h-4 ${getTypeColor(activity.type)} rounded-full shadow-[0_0_0_4px_white]`}></div>
              <h3 className="font-bold text-lg text-zinc-800">{activity.title}</h3>
              <p className="text-sm text-zinc-500 font-medium mb-2">{activity.date}</p>
              <p className="text-sm text-zinc-600 leading-relaxed">{activity.description}</p>
              
              {activity.summary && (
                <div className="text-sm mt-2 bg-zinc-50 border border-zinc-100 p-3 rounded-xl flex items-center justify-between text-zinc-600 cursor-pointer hover:bg-zinc-100 transition-colors">
                  <span className="font-medium">{activity.summary}</span>
                  <ChevronDown size={18} className="text-zinc-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
