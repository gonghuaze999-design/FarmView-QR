import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { getMachineTasks } from '../services/api';
import { useSiteContext } from '../contexts/SiteContext';

interface Activity {
  id: string;
  date: string;
  title: string;
  description: string;
  summary?: string;
  type: string;
}

export const TimelineSection: React.FC = () => {
  const { binding } = useSiteContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await getMachineTasks(1); // 默认 baseId 1
        if (res.code === "200" && res.content?.page) {
          const tasks = res.content.page.map((task: any) => ({
            id: task.ID || String(Math.random()),
            date: task.jobTime?.split(' ')[0] || '未知时间',
            title: task.jobType || '农事作业',
            description: `设备: ${task.productType || '未知设备'}`,
            summary: `作业面积: ${task.area || 0}亩`,
            type: 'other'
          }));
          setActivities(tasks);
        }
      } catch (e) {
        console.error('Failed to fetch machine tasks', e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [binding]);

  // 动态计算数据包含的年份，并降序排列
  const years = useMemo(() => {
    if (activities.length === 0) return [new Date().getFullYear()];
    const y = Array.from(new Set(activities.map(a => new Date(a.date).getFullYear())));
    return y.sort((a, b) => b - a);
  }, [activities]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years]);

  // 根据选择的年份过滤数据，并按时间倒序排列
  const filteredActivities = useMemo(() => {
    return activities
      .filter(a => new Date(a.date).getFullYear() === selectedYear)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedYear, activities]);

  const getTypeColor = (type: string) => {
    return 'bg-emerald-500';
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

      {loading ? (
        <div className="text-center py-8 text-zinc-400 text-sm">加载中...</div>
      ) : filteredActivities.length === 0 ? (
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
