import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Thermometer, Droplets, Wind, CloudRain, Sun, Zap, BarChart3, Bug, Sprout, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { getFarmlandList, getIotLocations, getEnvLatest, getSoilReport, getInsectData, getInsectImages } from '../services/api';

/* ================================================================
   气象指标区 — 扩大查询范围至180天，设备离线也能抓到末次记录
   ================================================================ */
const WEATHER_DIMS = [
  { dim: 'air_temperature',      label: '空气温度', unit: '°C',    Icon: Thermometer, color: '#0ea5e9', bg: '#f0f9ff' },
  { dim: 'air_humidity',         label: '空气湿度', unit: '%',     Icon: Droplets,    color: '#059669', bg: '#ecfdf5' },
  { dim: 'wind_speed',           label: '风速',     unit: 'm/s',   Icon: Wind,        color: '#0d9488', bg: '#f0fdfa' },
  { dim: 'precipitation',        label: '降水量',   unit: 'mm',    Icon: CloudRain,   color: '#4f46e5', bg: '#eef2ff' },
  { dim: 'light_intensity',      label: '光照强度', unit: 'lux',   Icon: Sun,         color: '#d97706', bg: '#fffbeb' },
  { dim: 'atmospheric_pressure', label: '大气压',   unit: 'hPa',   Icon: BarChart3,   color: '#64748b', bg: '#f8fafc' },
  { dim: 'soil_temperature',     label: '土壤温度', unit: '°C',    Icon: Thermometer, color: '#b45309', bg: '#fffbeb' },
  { dim: 'soil_humidity',        label: '土壤水分', unit: '%',     Icon: Droplets,    color: '#0369a1', bg: '#f0f9ff' },
  { dim: 'soil_ec',              label: '土壤EC值', unit: 'μS/cm', Icon: Zap,        color: '#7c3aed', bg: '#f5f3ff' },
];

const WeatherPanel: React.FC<{ farmlandId: string | null; refreshKey: number }> = ({ farmlandId, refreshKey }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [timeHint, setTimeHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [panelKey, setPanelKey] = useState(0);

  const fetchWeather = useCallback(async () => {
    if (!farmlandId) { setLoading(false); return; }
    setLoading(true);

    const dims1 = WEATHER_DIMS.slice(0, 6).map(d => d.dim).join(',');
    const dims2 = WEATHER_DIMS.slice(6).map(d => d.dim).join(',');
    const [res1, res2] = await Promise.allSettled([
      getEnvLatest(farmlandId, dims1, 10),
      getEnvLatest(farmlandId, dims2, 10),
    ]);

    const latest: Record<string, string> = {};
    let latestTime = '';
    const extract = (res: any) => {
      if (res.code === 200 && res.data) {
        for (const [dim, arr] of Object.entries(res.data)) {
          if (!Array.isArray(arr) || arr.length === 0) continue;
          let last: any = null;
          for (let i = arr.length - 1; i >= Math.max(0, arr.length - 300); i--) {
            const v = (arr[i] as any)[dim];
            if (v != null && v !== 0) { last = arr[i]; break; }
          }
          if (!last) last = arr[arr.length - 1];
          const val = last[dim];
          if (val != null) latest[dim] = typeof val === 'number' ? val.toFixed(1) : String(val);
          if (last.reportTime && (!latestTime || String(last.reportTime) > latestTime)) {
            latestTime = String(last.reportTime);
          }
        }
      }
    };
    extract(res1.status === 'fulfilled' ? res1.value : {});
    extract(res2.status === 'fulfilled' ? res2.value : {});

    const displayTime = latestTime ? `记录时间 ${latestTime}` : '';
    setTimeHint(displayTime);
    setValues(latest);
    setLoading(false);
  }, [farmlandId, panelKey]);

  useEffect(() => { fetchWeather(); }, [fetchWeather, refreshKey]);

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2" style={{ background: '#f0f9ff' }}>
        <CloudRain size={16} className="text-sky-500" />
        <span className="text-sm font-bold text-zinc-800">气象监测</span>
        <div className="ml-auto flex items-center gap-1">
          {timeHint && <span className="text-[10px] text-zinc-400">{timeHint}</span>}
          <button
            onClick={() => setPanelKey(k => k + 1)}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/60 transition-colors"
            title="刷新气象数据"
          >
            <RefreshCw size={12} className="text-zinc-400" />
          </button>
        </div>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WEATHER_DIMS.map(d => {
              const v = values[d.dim];
              return (
                <div key={d.dim}
                  className="rounded-xl border border-zinc-100/60 flex flex-col justify-between"
                  style={{ background: d.bg, height: 68 }}
                >
                  <div className="flex items-center gap-1 px-2.5 pt-2">
                    <d.Icon size={12} style={{ color: d.color, flexShrink: 0 }} />
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap leading-none">{d.label}</span>
                  </div>
                  <div className="px-2.5 pb-2">
                    <span className="text-[15px] font-bold text-zinc-800 leading-none">
                      {v ?? '—'}
                    </span>
                    <span className="text-[10px] font-normal text-zinc-400 ml-0.5">{d.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================================================
   墒情区（土壤监测）
   ================================================================ */
const SOIL_ITEMS = [
  { keys: ['nitrogen','soil_nitrogen'],          label: '全氮',   unit: 'g/kg',   color: '#059669', max: 80 },
  { keys: ['phosphorus','soil_phosphorus'],      label: '有效磷', unit: 'mg/kg',  color: '#d97706', max: 70 },
  { keys: ['potassium','soil_potassium'],        label: '缓效钾', unit: 'mg/kg',  color: '#7c3aed', max: 200 },
  { keys: ['organicMatter'],                     label: '有机质', unit: 'g/kg',   color: '#4f46e5', max: 60 },
  { keys: ['ph','soil_ph'],                      label: 'pH值',   unit: '',       color: '#0ea5e9', max: 14 },
  { keys: ['soil_ec'],                           label: '土壤EC', unit: 'μS/cm',  color: '#0891b2', max: 3 },
];

function soilVal(record: any, keys: string[]): number | null {
  for (const k of keys) {
    const v = record[k];
    if (v != null && v !== '') return Number(v);
  }
  return null;
}

const SoilPanel: React.FC<{ baseId: number | null; refreshKey: number }> = ({ baseId, refreshKey }) => {
  const [soil, setSoil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [panelKey, setPanelKey] = useState(0);

  useEffect(() => {
    if (!baseId) { setLoading(false); return; }
    setLoading(true);
    getSoilReport(baseId).then(res => {
      if (res.code === 200) {
        const data = res.soil || res.data;
        if (Array.isArray(data) && data.length > 0) setSoil(data[data.length - 1]);
        else if (data && typeof data === 'object' && !Array.isArray(data)) setSoil(data);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [baseId, refreshKey, panelKey]);

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2" style={{ background: '#fffbeb' }}>
        <Sprout size={16} className="text-amber-600" />
        <span className="text-sm font-bold text-zinc-800">土壤检测</span>
        {soil?.reportTime && <span className="text-[10px] text-zinc-400 ml-auto mr-1">末次检测 {soil.reportTime}年</span>}
        {!soil?.reportTime && soil?.report_farm && <span className="text-[10px] text-zinc-400 ml-auto mr-1">{soil.report_farm}</span>}
        <button
          onClick={() => setPanelKey(k => k + 1)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/60 transition-colors"
          title="刷新土壤数据"
        >
          <RefreshCw size={12} className="text-zinc-400" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-zinc-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : !soil ? (
          <div className="text-center py-6 text-zinc-400 text-sm">暂无土壤检测数据</div>
        ) : (
          SOIL_ITEMS.map(item => {
            const val = soilVal(soil, item.keys);
            if (val == null && item.keys[0] === 'organicMatter') return null;
            const pct = val != null ? Math.min((val / item.max) * 100, 100) : 0;
            return (
              <div key={item.keys[0]} className="flex items-center gap-3" style={{ height: 24 }}>
                <span className="text-xs text-zinc-500 w-12 shrink-0">{item.label}</span>
                <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: item.color, opacity: val != null ? 1 : 0.25 }}
                  />
                </div>
                <span className="text-xs font-bold text-zinc-700 w-20 text-right tabular-nums">
                  {val != null ? <>{val}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">{item.unit}</span></> : '—'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ================================================================
   虫情区 — 扩大至全年，设备离线也能抓到末次记录
   ================================================================ */
const InsectPanel: React.FC<{ farmlandId: string | null; refreshKey: number }> = ({ farmlandId, refreshKey }) => {
  const [total, setTotal] = useState<number | null>(null);
  const [topInsects, setTopInsects] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [timeHint, setTimeHint] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgCount, setImgCount] = useState(8);
  const [panelKey, setPanelKey] = useState(0);
  const scrollRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!farmlandId) { setLoading(false); return; }
    setLoading(true);
    const now = new Date();
    const end = now.toISOString().replace('T', ' ').slice(0, 19);
    // 全年范围，抓DB末次记录
    const start = new Date(now.getTime() - 365 * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    Promise.allSettled([
      getInsectData(farmlandId, start, end),
      getInsectImages(farmlandId, start, end),
    ]).then(([statRes, imgRes]) => {
      if (statRes.status === 'fulfilled' && statRes.value?.code === 200) {
        const d = statRes.value.data;
        if (d) {
          setTotal(typeof d.total === 'number' ? d.total : null);
          if (Array.isArray(d.insect)) setTopInsects(d.insect.slice(0, 5));
        }
      }
      if (imgRes.status === 'fulfilled' && imgRes.value?.code === 200) {
        const d = imgRes.value.data;
        const list = Array.isArray(d) ? d : (d?.images || []);
        setImages(list);
        // 取最后一张图片的上报时间
        if (list.length > 0) {
          const lastImg = list[list.length - 1];
          const rt = lastImg?.reportTime;
          if (rt) {
            const t = String(rt);
            // 格式: "2025-06-23 21:57:41" 或 "2025-06-23"
            setTimeHint(`末次记录 ${t.length >= 16 ? t.slice(0, 16) : t}`);
          }
        }
      }
      setImgCount(8);
      setLoading(false);
    });
  }, [farmlandId, refreshKey, panelKey]);

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2" style={{ background: '#f5f3ff' }}>
        <Bug size={16} className="text-violet-600" />
        <span className="text-sm font-bold text-zinc-800">虫情测报</span>
        {timeHint && <span className="text-[10px] text-zinc-400 ml-auto mr-1">{timeHint}</span>}
        <button
          onClick={() => setPanelKey(k => k + 1)}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/60 transition-colors"
          title="刷新虫情数据"
        >
          <RefreshCw size={12} className="text-zinc-400" />
        </button>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : total == null && topInsects.length === 0 ? (
          <div className="text-center py-6 text-zinc-400 text-sm">暂无虫情数据</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-zinc-500">累计诱虫</span>
              <span className="text-2xl font-bold text-violet-700">
                {total != null ? total.toLocaleString() : '—'}<span className="text-sm font-normal text-violet-400 ml-1">只</span>
              </span>
            </div>

            {topInsects.length > 0 && (
              <div className="space-y-2 mb-4">
                <span className="text-[10px] text-zinc-400">虫害排行 Top 5</span>
                {topInsects.map((item: any, i: number) => {
                  const pct = typeof item.percent === 'number' ? item.percent : (item.insectValue / (total || 1)) * 100;
                  return (
                    <div key={i} className="flex items-center gap-2" style={{ height: 18 }}>
                      <span className="text-[10px] text-zinc-400 w-3 text-right">{i + 1}</span>
                      <span className="text-xs text-zinc-700 w-18 truncate">{item.insectName || '未知'}</span>
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-500 w-12 text-right tabular-nums">{item.insectValue}只</span>
                    </div>
                  );
                })}
              </div>
            )}

            {images.length > 0 && (
              <div>
                <span className="text-[10px] text-zinc-400 block mb-2">虫情照片（{images.length}张）</span>
                <div
                  ref={scrollRowRef}
                  className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
                  style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
                  onScroll={() => {
                    const el = scrollRowRef.current;
                    if (el && el.scrollLeft + el.clientWidth >= el.scrollWidth - 40) {
                      setImgCount(c => Math.min(c + 8, images.length));
                    }
                  }}
                >
                  {images.slice(0, imgCount).map((img: any, i: number) => {
                    const url = img.imageResult || img.image || img.imageUrl || img.url || img.imgUrl || img.picture;
                    if (!url) return null;
                    return (
                      <button key={i} onClick={() => setLightboxImg(url)}
                        className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-100"
                        style={{ scrollSnapAlign: 'start' }}>
                        <img src={url} alt="虫情" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {lightboxImg && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightboxImg(null)}><X size={24} /></button>
          <img src={lightboxImg} alt="虫情大图" className="max-w-full max-h-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

/* ================================================================
   数据 Tab 主组件 — 按设备类型匹配对应地块ID查询
   ================================================================ */
export const MonitoringSection: React.FC = () => {
  const { binding } = useSiteContext();
  const [weatherFid, setWeatherFid] = useState<string | null>(null);
  const [insectFid, setInsectFid] = useState<string | null>(null);
  const [hasSoilSensor, setHasSoilSensor] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!binding) return;
    const baseId = binding.baseId;
    setDevicesLoading(true);

    Promise.all([
      getFarmlandList(baseId),
      getIotLocations(baseId),
    ]).then(([landRes, iotRes]) => {
      const lands: any[] = landRes.code === 200 ? (landRes.data || []) : [];
      const devices: any[] = iotRes.code === 200 ? (iotRes.data || []) : [];

      // 设备名提取乡镇关键词 → 匹配地块
      const matchFarmland = (devName: string): string | null => {
        const n = String(devName || '');
        for (const kw of ['新元', '关坪', '罗田', '大进', '紫水', '大德', '和谦']) {
          if (n.includes(kw)) {
            const matched = lands.find((l: any) =>
              String(l.farmlandName || '').includes(kw) && String(l.farmlandName || '').includes('1号')
            );
            if (matched) return String(matched.id);
            // 没有1号地块，找任意包含该关键词的地块
            const any = lands.find((l: any) => String(l.farmlandName || '').includes(kw));
            if (any) return String(any.id);
          }
        }
        return null;
      };

      let wfid: string | null = null;
      let ifid: string | null = null;
      let hasSoil = false;

      for (const d of devices) {
        const name = String(d.name || '').toLowerCase();
        if (!wfid && (name.includes('气象') || name.includes('weather'))) {
          wfid = matchFarmland(d.name);
        }
        if (!ifid && name.includes('虫')) {
          ifid = matchFarmland(d.name);
        }
        if (name.includes('土壤') || name.includes('墒情') || name.includes('soil')) {
          hasSoil = true;
        }
      }

      setWeatherFid(wfid);
      setInsectFid(ifid);
      setHasSoilSensor(hasSoil);
      setDevicesLoading(false);
    }).catch(() => setDevicesLoading(false));
  }, [binding]);

  const doRefresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    const t = setInterval(() => setRefreshKey(k => k + 1), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (devicesLoading) {
    return (
      <section className="px-4 pb-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 animate-pulse" />
          <div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" />
        </div>
        {[1,2,3].map(i => <div key={i} className="h-48 bg-zinc-50 rounded-2xl animate-pulse" />)}
      </section>
    );
  }

  return (
    <section className="px-4 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0f9ff' }}>
            <BarChart3 size={16} className="text-sky-600" />
          </span>
          <h2 className="text-base font-bold text-zinc-800">数据监测</h2>
        </div>
        <button
          onClick={doRefresh}
          className="text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200 px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> 全部刷新
        </button>
      </div>

      {!weatherFid && !insectFid ? (
        <div className="text-center py-16 text-zinc-400 text-sm bg-white rounded-2xl border border-zinc-100">
          <AlertTriangle size={28} className="mx-auto mb-3 text-zinc-300" />
          该基地未布设物联网监测设备
        </div>
      ) : (
        <>
          {weatherFid ? (
            <WeatherPanel farmlandId={weatherFid} refreshKey={refreshKey} />
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-100 p-6 text-center text-zinc-400 text-sm">
              该基地未布设气象监测设备
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 min-w-0">
              {hasSoilSensor ? (
                <SoilPanel baseId={binding?.baseId ?? null} refreshKey={refreshKey} />
              ) : (
                <div className="bg-white rounded-2xl border border-zinc-100 p-6 text-center text-zinc-400 text-sm h-full flex items-center justify-center">
                  <div>该基地未布设土壤墒情传感器<br /><span className="text-xs text-zinc-300 mt-1">如布设后将自动显示土壤检测结果</span></div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {insectFid ? (
                <InsectPanel farmlandId={insectFid} refreshKey={refreshKey} />
              ) : (
                <div className="bg-white rounded-2xl border border-zinc-100 p-6 text-center text-zinc-400 text-sm h-full flex items-center justify-center">
                  该基地未布设虫情监测设备
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
