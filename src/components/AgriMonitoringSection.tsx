import React, { useState, useEffect } from 'react';
import { Sprout, RefreshCw, ImageOff } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { getGrowthData } from '../services/api';

interface GrowRecord {
  id: string;
  algorithmTaskId: string;
  reportTime: string;
  mode: number | null;
}

const getModeLabel = (mode: number | null): { label: string; color: string; desc: string } => {
  if (mode === null) return { label: '--', color: 'text-zinc-400', desc: '暂无数据' };
  if (mode >= 0.8) return { label: '优', color: 'text-emerald-600', desc: '长势良好' };
  if (mode >= 0.6) return { label: '良', color: 'text-blue-600', desc: '长势正常' };
  if (mode >= 0.4) return { label: '中', color: 'text-amber-600', desc: '长势一般' };
  return { label: '差', color: 'text-red-500', desc: '长势较差' };
};

export const AgriMonitoringSection: React.FC<{ selectedYear?: number }> = ({ selectedYear }) => {
  const { binding } = useSiteContext();
  const [records, setRecords] = useState<GrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const PREVIEW_COUNT = 10;

  const year = selectedYear || new Date().getFullYear();

  const fetchData = async () => {
    if (!binding?.farmlandIds?.length) return;
    setLoading(true);
    try {
      const farmlandId = binding.farmlandIds[0];
      const startTime = `${year}-01-01 00:00:00`;
      const endTime = `${year}-12-31 23:59:59`;
      const res = await getGrowthData(farmlandId, startTime, endTime);
      if (res.code === 200 && Array.isArray(res.data)) {
        const parsed: GrowRecord[] = res.data
          .filter((r: any) => r.reportTime)
          .map((r: any) => ({
            id: String(r.id),
            algorithmTaskId: String(r.algorithmTaskId || ''),
            reportTime: r.reportTime,
            mode: r.mode != null ? Number(r.mode) : null,
          }))
          .sort((a: GrowRecord, b: GrowRecord) => b.reportTime.localeCompare(a.reportTime));
        setRecords(parsed);
      } else {
        setRecords([]);
      }
    } catch (e) {
      console.error('Failed to fetch growth data', e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [binding, year]);

  return (
    <section className="px-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
          <Sprout size={18} className="text-emerald-500" />
          农情监测
        </h2>
        <button
          onClick={fetchData}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-zinc-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 text-sm bg-zinc-50 rounded-3xl border border-zinc-100">
          {year}年暂无农情监测数据
        </div>
      ) : (
        <div className="space-y-3">
          {(expanded ? records : records.slice(0, PREVIEW_COUNT)).map((record) => {
            const modeInfo = getModeLabel(record.mode);
            return (
              <div key={record.id} className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden flex">
                {/* 左侧：图片占位 */}
                <div className="w-24 h-24 bg-zinc-100 flex-shrink-0 flex items-center justify-center">
                  <ImageOff size={20} className="text-zinc-300" />
                </div>

                {/* 右侧：分析结果 */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-zinc-400">{record.reportTime}</p>
                      <p className="text-sm font-semibold text-zinc-700 mt-0.5">无人机长势分析</p>
                    </div>
                    <div className={`text-2xl font-bold ${modeInfo.color}`}>
                      {modeInfo.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      modeInfo.label === '优' ? 'bg-emerald-50 text-emerald-600' :
                      modeInfo.label === '良' ? 'bg-blue-50 text-blue-600' :
                      modeInfo.label === '中' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {modeInfo.desc}
                    </span>
                    {record.mode !== null && (
                      <span className="text-xs text-zinc-400">
                        NDVI: {record.mode.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {records.length > PREVIEW_COUNT && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 py-2.5 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-2xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            {expanded ? '收起' : `展开全部 ${records.length} 条记录`}
          </button>
        )}
      )}
    </section>
  );
};
