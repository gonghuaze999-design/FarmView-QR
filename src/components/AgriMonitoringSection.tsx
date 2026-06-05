import React, { useState, useEffect, useCallback } from 'react';
import { Sprout, RefreshCw, X, Download, Loader2, ChevronDown, ChevronUp, ZoomIn } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { getFarmMonitorSatellite, type SatelliteRecord } from '../services/api';

const PREVIEW_COUNT = 5;

const GRADE_STYLE: Record<string, { text: string; badge: string; big: string; bar: string }> = {
  '优': { text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', big: 'text-emerald-600', bar: 'bg-emerald-500' },
  '良': { text: 'text-blue-600', badge: 'bg-blue-50 text-blue-600', big: 'text-blue-600', bar: 'bg-blue-500' },
  '中': { text: 'text-amber-600', badge: 'bg-amber-50 text-amber-600', big: 'text-amber-600', bar: 'bg-amber-500' },
  '差': { text: 'text-red-500', badge: 'bg-red-50 text-red-500', big: 'text-red-500', bar: 'bg-red-500' },
  '—': { text: 'text-zinc-400', badge: 'bg-zinc-100 text-zinc-500', big: 'text-zinc-400', bar: 'bg-zinc-400' },
};

function getImageUrl(rec: SatelliteRecord): string | undefined {
  return rec.ndvi_field_view_url || rec.ndvi_overview_url;
}

function getGrade(mean: number): string {
  if (mean >= 0.70) return '优';
  if (mean >= 0.55) return '良';
  if (mean >= 0.35) return '中';
  return '差';
}

function getFieldName(rec: SatelliteRecord, fields?: any[]): string {
  if (rec._localFieldId && fields) {
    const f = fields.find((l: any) => String(l.id) === rec._localFieldId);
    if (f) return f.farmlandName || `地块${f.id}`;
  }
  return rec.field_id?.slice(0, 8) || '—';
}

interface DetailModalProps {
  record: SatelliteRecord;
  fieldName: string;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ record, fieldName, onClose }) => {
  const grade = getGrade(record.ndvi_stats?.mean || 0);
  const g = GRADE_STYLE[grade];
  const s = record.ndvi_stats;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部栏 */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-4 border-b border-zinc-100 flex items-center justify-between rounded-t-3xl z-10">
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-800">{record.date}</p>
            <p className="text-xs text-zinc-400">{fieldName}</p>
          </div>
          <span className={`text-lg font-bold ${g.big}`}>{grade}</span>
        </div>

        <div className="p-5 space-y-5">
          {/* NDVI 大图 */}
          {getImageUrl(record) && (
            <div className="rounded-2xl overflow-hidden border border-zinc-100 bg-zinc-50">
              <img
                src={getImageUrl(record)}
                alt="NDVI 农情监测图"
                className="w-full h-auto object-contain"
                style={{ maxHeight: '50vh' }}
              />
            </div>
          )}

          {/* NDVI 统计 */}
          {s && (
            <div>
              <h3 className="text-sm font-bold text-zinc-700 mb-3">NDVI 统计</h3>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: '均值', value: s.mean?.toFixed(3) },
                  { label: '最大值', value: s.max?.toFixed(3) },
                  { label: '最小值', value: s.min?.toFixed(3) },
                  { label: '标准差', value: s.std?.toFixed(3) },
                  { label: '中位数 P50', value: s.p50?.toFixed(3) },
                  { label: '有效像素', value: s.pixel_count ? `${(s.pixel_count / 10000).toFixed(1)}万` : '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                    <p className="text-[10px] text-zinc-400 mb-0.5">{item.label}</p>
                    <p className="text-sm font-bold text-zinc-800">{item.value ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 植被覆盖分布 */}
          {s && (
            <div>
              <h3 className="text-sm font-bold text-zinc-700 mb-3">植被覆盖分布</h3>
              <div className="space-y-2.5">
                {[
                  { label: '高植被', pct: s.high_veg_pct, color: 'bg-emerald-500', desc: 'NDVI ≥ 0.6' },
                  { label: '中植被', pct: s.mid_veg_pct, color: 'bg-amber-400', desc: '0.3 ≤ NDVI < 0.6' },
                  { label: '低植被', pct: s.low_veg_pct, color: 'bg-red-400', desc: 'NDVI < 0.3' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-14 shrink-0">{item.label}</span>
                    <div className="flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all`}
                        style={{ width: `${Math.max(item.pct || 0, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-700 w-12 text-right">{item.pct?.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-zinc-400">
                {[
                  { label: '高植被', desc: 'NDVI ≥ 0.6' },
                  { label: '中植被', desc: '0.3~0.6' },
                  { label: '低植被', desc: '< 0.3' },
                ].map((item, i) => (
                  <span key={i}>{item.label}: {item.desc}</span>
                ))}
              </div>
            </div>
          )}

          {/* AI 解读 */}
          {record.ndvi_interpretation && (
            <div>
              <h3 className="text-sm font-bold text-zinc-700 mb-2">AI 农情解读</h3>
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                  {record.ndvi_interpretation}
                </p>
              </div>
            </div>
          )}

          {/* 下载按钮 */}
          {getImageUrl(record) && (
            <a
              href={getImageUrl(record)}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-2xl transition-colors"
            >
              <Download size={16} />
              下载 NDVI 图片
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export const AgriMonitoringSection: React.FC = () => {
  const { siteKey } = useSiteContext();
  const [records, setRecords] = useState<SatelliteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [detailRecord, setDetailRecord] = useState<SatelliteRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getFarmMonitorSatellite(siteKey, showRefresh);
      if (res.initializing || res.loading) {
        setInitializing(true);
        setMessage(res.message || '卫星监测服务初始化中...');
        // 3秒后自动重试
        setTimeout(() => fetchData(false), 3000);
        setRecords([]);
      } else if (res.ok) {
        setInitializing(false);
        setRecords(res.data || []);
        if (res.data?.length === 0) setMessage('暂无卫星数据，今日数据将在 8:00 后更新');
      } else {
        setError('数据获取失败');
      }
    } catch (e: any) {
      setError(e.message || '网络请求失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const visibleRecords = expanded ? records : records.slice(0, PREVIEW_COUNT);

  return (
    <section className="px-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <Sprout size={16} className="text-purple-600" />
          </span>
          <h2 className="text-base font-bold text-zinc-800">农情监测</h2>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200 px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-zinc-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : initializing ? (
        <div className="text-center py-12 bg-amber-50 rounded-3xl border border-amber-100">
          <Loader2 size={28} className="text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-amber-700">{message}</p>
          <p className="text-xs text-amber-500 mt-1">首次初始化需要几分钟，请耐心等待</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 bg-red-50 rounded-3xl border border-red-100">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="text-sm bg-red-500 text-white hover:bg-red-600 px-5 py-2 rounded-full font-medium transition-colors"
          >
            重试
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-10 bg-zinc-50 rounded-3xl border border-zinc-100">
          <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sprout size={22} className="text-zinc-300" />
          </div>
          <p className="text-sm text-zinc-500">{message || '暂无卫星监测数据'}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleRecords.map(rec => {
              const grade = getGrade(rec.ndvi_stats?.mean || 0);
              const g = GRADE_STYLE[grade];
              const s = rec.ndvi_stats;
              const aiPreview = rec.ndvi_interpretation?.split('\n')[0]?.slice(0, 60) || '';
              const fieldName = rec._localFieldId || rec.field_id?.slice(0, 8);

              return (
                <button
                  key={rec.id}
                  onClick={() => setDetailRecord(rec)}
                  className="w-full bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex text-left hover:shadow-md hover:border-zinc-200 transition-all active:scale-[0.98]"
                >
                  {/* 左侧缩略图 */}
                  <div className="w-[90px] h-[90px] bg-zinc-100 flex-shrink-0 flex items-center justify-center relative">
                    {getImageUrl(rec) ? (
                      <>
                        <img
                          src={getImageUrl(rec)}
                          alt="NDVI"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute bottom-1 right-1 bg-black/30 rounded-full p-0.5">
                          <ZoomIn size={10} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <Sprout size={24} className="text-zinc-300" />
                    )}
                  </div>

                  {/* 右侧信息 */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-[11px] text-zinc-400 font-medium">{rec.date}</p>
                        <p className="text-sm font-semibold text-zinc-700 mt-0.5 truncate">{fieldName}</p>
                      </div>
                      <span className={`text-lg font-bold shrink-0 ${g.big}`}>{grade}</span>
                    </div>

                    {/* NDVI 均值条 */}
                    {s && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${g.bar}`}
                            style={{ width: `${Math.min(s.mean * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-600">NDVI {s.mean?.toFixed(2)}</span>
                      </div>
                    )}

                    {/* AI 摘要 */}
                    {aiPreview && (
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-2">
                        {aiPreview}{aiPreview.length >= 60 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 展开/收起 */}
          {records.length > PREVIEW_COUNT && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-3 py-2.5 text-sm text-purple-600 font-medium bg-purple-50 rounded-2xl border border-purple-100 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1"
            >
              {expanded ? (
                <><ChevronUp size={14} /> 收起</>
              ) : (
                <><ChevronDown size={14} /> 展开全部 {records.length} 条记录</>
              )}
            </button>
          )}
        </>
      )}

      {/* 详情弹窗 */}
      {detailRecord && (
        <DetailModal
          record={detailRecord}
          fieldName={detailRecord._localFieldId || detailRecord.field_id?.slice(0, 8)}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </section>
  );
};
