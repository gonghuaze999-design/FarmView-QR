import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Calendar, Sprout, Tractor, Droplets, Scissors, Package } from 'lucide-react';
import { getFarmWorkTaskCount } from '../services/api';
import { useSiteContext } from '../contexts/SiteContext';

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '未开始', color: 'bg-zinc-100 text-zinc-500' },
  1: { label: '未分配', color: 'bg-amber-100 text-amber-600' },
  2: { label: '进行中', color: 'bg-blue-100 text-blue-600' },
  3: { label: '已完成', color: 'bg-emerald-100 text-emerald-600' },
  4: { label: '已取消', color: 'bg-red-100 text-red-500' },
};

const WORK_ICONS: Record<string, React.ReactNode> = {
  '播种': <Sprout size={16} />,
  '施肥': <Package size={16} />,
  '灌溉': <Droplets size={16} />,
  '收割': <Scissors size={16} />,
  '耕地': <Tractor size={16} />,
};

export const TimelineSection: React.FC = () => {
  const { binding } = useSiteContext();
  const [taskStats, setTaskStats] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2];
  }, []);

  useEffect(() => {
    if (!binding) return;
    setLoading(true);
    const startTime = `${selectedYear}-01-01 00:00:00`;
    const endTime = `${selectedYear}-12-31 23:59:59`;
    getFarmWorkTaskCount(binding.baseId, startTime, endTime)
      .then(res => {
        if (res.code === 200 && Array.isArray(res.data)) {
          setTaskStats(res.data);
        } else {
          setTaskStats([]);
        }
      })
      .catch(() => setTaskStats([]))
      .finally(() => setLoading(false));
  }, [binding, selectedYear]);

  const total = taskStats.reduce((sum, s) => sum + (s.count || 0), 0);
  const completed = taskStats.find(s => s.status === 3)?.count || 0;
  const inProgress = taskStats.find(s => s.status === 2)?.count || 0;
  const notStarted = taskStats.find(s => s.status === 0)?.count || 0;

  return (
    <section className="px-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
          <Tractor size={18} className="text-emerald-500" />
          农事行为
        </h2>
        <div className="relative">
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
          >
            <Calendar size={14} />
            {selectedYear}年
            <ChevronDown size={14} className={`transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
          </button>
          {showYearPicker && (
            <div className="absolute right-0 top-9 bg-white rounded-2xl shadow-lg border border-zinc-100 overflow-hidden z-10">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => { setSelectedYear(y); setShowYearPicker(false); }}
                  className={`block w-full px-5 py-2.5 text-sm text-left hover:bg-zinc-50 transition-colors ${y === selectedYear ? 'font-bold text-emerald-600' : 'text-zinc-700'}`}
                >
                  {y}年
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-24 bg-zinc-100 rounded-3xl animate-pulse" />
      ) : total === 0 ? (
        <div className="text-center py-8 text-zinc-400 text-sm bg-zinc-50 rounded-3xl border border-zinc-100">
          {selectedYear}年暂无农事记录
        </div>
      ) : (
        <div className="space-y-3">
          {/* 统计概览 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-100 text-center">
              <div className="text-2xl font-bold text-emerald-700">{completed}</div>
              <div className="text-xs text-emerald-600/70 mt-0.5">已完成</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100 text-center">
              <div className="text-2xl font-bold text-blue-700">{inProgress}</div>
              <div className="text-xs text-blue-600/70 mt-0.5">进行中</div>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-100 text-center">
              <div className="text-2xl font-bold text-zinc-700">{notStarted}</div>
              <div className="text-xs text-zinc-500 mt-0.5">未开始</div>
            </div>
          </div>

          {/* 状态分布条 */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-zinc-500">任务完成率</span>
              <span className="text-xs font-bold text-emerald-600">
                {total > 0 ? Math.round(completed / total * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden flex">
              {taskStats.map(s => (
                s.count > 0 && (
                  <div
                    key={s.status}
                    style={{ width: `${(s.count / total) * 100}%` }}
                    className={`h-full ${s.status === 3 ? 'bg-emerald-500' : s.status === 2 ? 'bg-blue-400' : s.status === 1 ? 'bg-amber-400' : 'bg-zinc-300'}`}
                  />
                )
              ))}
            </div>
            <div className="flex gap-3 mt-2 flex-wrap">
              {taskStats.filter(s => s.count > 0).map(s => (
                <span key={s.status} className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_MAP[s.status]?.color || 'bg-zinc-100 text-zinc-500'}`}>
                  {STATUS_MAP[s.status]?.label} {s.count}
                </span>
              ))}
            </div>
          </div>

          {/* 列表占位 */}
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 text-center">
            <p className="text-xs text-amber-600">农事活动详细列表接口对接中</p>
            <p className="text-[10px] text-amber-500 mt-1">共 {total} 条记录，详情待接口确认后展示</p>
          </div>
        </div>
      )}
    </section>
  );
};
