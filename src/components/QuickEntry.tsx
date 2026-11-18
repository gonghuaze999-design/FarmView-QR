import { useState } from 'react';
import { FileText, MonitorPlay, X } from 'lucide-react';

interface ReportItem {
  id: string;
  title: string;
  desc?: string;
  file: string;
  updated?: string;
}

const openReport = (file: string) => {
  const url = `${window.location.origin}${file}`;
  const w = window.open(url, '_blank');
  if (!w) window.location.href = url;
};

export const QuickEntry = () => {
  const [picker, setPicker] = useState<ReportItem[] | null>(null);
  const [showDash, setShowDash] = useState(false);

  const handleReport = async () => {
    try {
      const res = await fetch(`/reports/index.json?_t=${Date.now()}`);
      const list = (await res.json()) as ReportItem[];
      if (!Array.isArray(list) || list.length === 0) {
        setPicker([]);
        return;
      }
      if (list.length === 1) {
        openReport(list[0].file);
        return;
      }
      setPicker(list);
    } catch {
      setPicker([]);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {/* 报告 */}
        <button
          onClick={handleReport}
          className="rounded-xl p-3 flex items-center gap-2.5 text-left transition-transform active:scale-[0.98]"
          style={{ background: '#f5f3ff' }}
        >
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <FileText size={18} style={{ color: '#7c3aed' }} />
          </span>
          <span>
            <span className="block text-sm font-bold" style={{ color: '#7c3aed' }}>报告</span>
            <span className="block text-[10px] font-medium opacity-65" style={{ color: '#7c3aed' }}>年度种植分析</span>
          </span>
        </button>
        {/* 数据大屏 */}
        <button
          onClick={() => setShowDash(true)}
          className="rounded-xl p-3 flex items-center gap-2.5 text-left transition-transform active:scale-[0.98]"
          style={{ background: '#f0f9ff' }}
        >
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(2,132,199,0.12)' }}>
            <MonitorPlay size={18} style={{ color: '#0284c7' }} />
          </span>
          <span>
            <span className="block text-sm font-bold" style={{ color: '#0284c7' }}>数据大屏</span>
            <span className="block text-[10px] font-medium opacity-65" style={{ color: '#0284c7' }}>基地全景监控</span>
          </span>
        </button>
      </div>

      {/* 报告列表选择 */}
      {picker !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setPicker(null)}>
          <div
            className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold" style={{ color: '#1c2b24' }}>年度分析报告</h3>
              <button onClick={() => setPicker(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={16} style={{ color: '#5b6b62' }} />
              </button>
            </div>
            {picker.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">暂无报告</p>
            ) : (
              <div className="space-y-2">
                {picker.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => openReport(r.file)}
                    className="w-full text-left rounded-xl border border-gray-100 px-4 py-3 hover:border-purple-200 hover:bg-purple-50/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={15} style={{ color: '#7c3aed' }} />
                      <span className="text-sm font-bold" style={{ color: '#1c2b24' }}>{r.title}</span>
                    </span>
                    <span className="block text-xs mt-1 pl-6" style={{ color: '#5b6b62' }}>
                      {r.desc || ''}{r.updated ? ` · 更新于 ${r.updated}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 数据大屏占位 */}
      {showDash && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowDash(false)}>
          <div
            className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 pb-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold" style={{ color: '#1c2b24' }}>数据大屏</h3>
              <button onClick={() => setShowDash(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={16} style={{ color: '#5b6b62' }} />
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#5b6b62' }}>
              基地全景数据大屏正在设计中，设计文档 v1.0 已发布，待确认后将开发上线。敬请期待。
            </p>
          </div>
        </div>
      )}
    </>
  );
};
