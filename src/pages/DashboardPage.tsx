import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, RotateCcw, RotateCw } from 'lucide-react';
import { HlsPlayer } from '../components/CameraTab';
import { MapComponent, type DeviceMarker } from '../components/MapComponent';
import { wgs84ToGcj02 } from '../utils/coordTransform';
import '../dashboard.css';

type Template = 'A' | 'B' | 'C' | 'E' | 'F';

interface AnnualReport {
  id: string;
  title: string;
  file: string;
  type?: string;
  year?: number;
  updated?: string;
}
interface SnapshotKpi {
  benchmarkYield: number;
  benchmarkRegion: string;
  area: number;
  landCount: number;
  regionCount: number;
  price: number;
  breakeven: number;
  yieldActual: number;
  targetYield: number[];
  heatDays: number;
  sepRain: number;
  ndviPeak: number;
  insectTotal: number;
  cameras: number;
  devices: number;
  workTasks: number;
  benchmarkRevenue: number;
}
interface Snapshot {
  year: number;
  baseName: string;
  updated: string;
  kpi: SnapshotKpi;
  value: { headline: string; chain: string[]; items: { label: string; text: string }[] };
}
interface LandPoly {
  id: string;
  farmlandName: string;
  size: number;
  backgroundColor: string;
  borderColor: string;
  transparency: number;
  borderWidth: number;
  coordinates: [number, number][];
  centroid: [number, number];
}
interface Camera {
  id: string;
  name: string;
  hls: string;
  status: number;
}

const useCountUp = (target: number, decimals = 0, duration = 1400) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(parseFloat((target * eased).toFixed(decimals)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, decimals, duration]);
  return v;
};
const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };
};
const templateOf = (w: number, h: number, isPhone: boolean): Template => {
  if (w === 0 || h === 0) return 'A';
  const ar = w / h;
  if (ar >= 1.9) return 'E';
  if (ar >= 1.55) return 'A';
  if (ar >= 1.35) return 'B';
  if (ar >= 1) return 'C';
  // AR < 1：手机竖屏降级用 F；大屏设备(折叠屏展开 0.89:1 等)用 C 四象限
  return isPhone ? 'F' : 'C';
};

/* ---------- 地图（与总览页同方案：高德卫星+路网+地块+设备） ---------- */
const MapPanel = ({
  polygons,
  devices,
  center,
  mapRef,
  onDeviceClick,
}: {
  polygons: LandPoly[];
  devices: DeviceMarker[];
  center?: [number, number];
  mapRef: MutableRefObject<any>;
  onDeviceClick?: (d: DeviceMarker) => void;
}) => {
  if (!center) {
    return (
      <div className="mod-ph">
        <div className="mod-ph-icon" />
        <div>地图加载中…</div>
      </div>
    );
  }
  return (
    <div className="map-wrap">
      <MapComponent
        ref={mapRef}
        isFullScreen={false}
        center={center}
        polygon={[]}
        polygons={polygons}
        devices={devices}
        onDeviceClick={onDeviceClick}
      />
    </div>
  );
};

/* ---------- 气象面板（气象站实时 + 7日预报 + 灾害提示） ---------- */
const WeatherPanel = ({ firstLandId, wgsCenter, kpi }: {
  firstLandId?: string;
  wgsCenter?: [number, number];
  kpi?: SnapshotKpi;
}) => {
  const [station, setStation] = useState<Record<string, unknown> | null>(null);
  const [fc, setFc] = useState<{ d: string; tmax: number; tmin: number; rain: number }[] | null>(null);
  const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';

  useEffect(() => {
    if (firstLandId) {
      fetch('/api/collect/iot/getEnvRecordNow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Site-Name': siteKey },
        body: JSON.stringify({ farmlandId: firstLandId }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.code === 200 && d.data) setStation(d.data); })
        .catch(() => {});
    }
  }, [firstLandId, siteKey]);

  useEffect(() => {
    if (!wgsCenter) return;
    const [lng, lat] = wgsCenter;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=7`
    )
      .then((r) => r.json())
      .then((d) => {
        const daily = d.daily;
        if (!daily) return;
        setFc(
          daily.time.map((t: string, i: number) => ({
            d: t.slice(5),
            tmax: Math.round(daily.temperature_2m_max[i]),
            tmin: Math.round(daily.temperature_2m_min[i]),
            rain: daily.precipitation_probability_max[i] ?? 0,
          }))
        );
      })
      .catch(() => {});
  }, [wgsCenter]);

  const temp = station ? Number(station['空气温度']) : null;
  const humi = station ? Number(station['空气湿度']) : null;
  const wdir = station ? String(station['风向'] || '') : '';
  const wforce = station ? Number(station['fx'] ?? station['风速']) : null;
  const reportTime = station ? String(station['report_time'] || '') : '';
  const warnHeat = (fc || []).slice(0, 3).some((f) => f.tmax >= 35);
  const warnRain = (fc || []).slice(0, 3).some((f) => f.rain >= 80);

  const metrics: [string, string][] = [];
  if (humi != null && humi > 0) metrics.push(['湿度', `${humi.toFixed(0)}%`]);
  if (wdir) metrics.push(['风向', wdir]);
  if (wforce != null && wforce > 0) metrics.push(['风力', `${wforce.toFixed(0)} m/s`]);

  return (
    <div className="wth-wrap">
      <div className="wth-main">
        <div className="wth-temp-big">
          {temp != null ? temp.toFixed(1) : '—'}
          <i>°C</i>
        </div>
        <div className="wth-metrics">
          {metrics.map(([k, v]) => (
            <div key={k} className="wth-metric">
              <span>{k}</span>
              <b>{v}</b>
            </div>
          ))}
        </div>
      </div>
      {reportTime && <div className="wth-station">基地气象站 · {reportTime.slice(5, 16)}</div>}
      {warnHeat && <div className="wth-warn r">高温预警：未来3天 ≥35°C</div>}
      {warnRain && <div className="wth-warn b">降雨预警：未来3天概率 ≥80%</div>}
      <div className="wth-fc">
        {(fc || []).map((f, i) => {
          const lo = ((f.tmin + 5) / 45) * 100;
          const span = Math.max(8, ((f.tmax - f.tmin) / 45) * 100);
          return (
            <div key={i} className={`wth-fc-row ${i === 0 ? 'today' : ''}`}>
              <span className="wth-fc-d">{i === 0 ? '今天' : f.d}</span>
              <span className="wth-fc-track">
                <i style={{ left: `${Math.min(92, lo)}%`, width: `${Math.min(100 - lo, span)}%` }} />
              </span>
              <span className="wth-fc-t">{f.tmin}°~{f.tmax}°</span>
              <span className="wth-fc-r" style={{ color: f.rain >= 60 ? '#38bdf8' : '#64748b' }}>{f.rain}%</span>
            </div>
          );
        })}
      </div>
      {kpi && (
        <div className="wth-year">
          本年度：≥35°C 高温 {kpi.heatDays} 天 · 9月降雨 {kpi.sepRain} mm
        </div>
      )}
    </div>
  );
};

/* ---------- NDVI 长势（30天曲线 + 分区对比 + 影像轮播） ---------- */
const NdviPanel = ({ polygons }: { polygons: LandPoly[] }) => {
  const [view, setView] = useState<{ series: { d: string; v: number }[]; regions: { name: string; v: number }[]; imgs: { url: string; date: string; land: string }[] } | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';

  useEffect(() => {
    fetch(`/api/farm-monitor/satellite?site=${encodeURIComponent(siteKey)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.data) ? d.data : [];
        const nameOf: Record<string, string> = {};
        polygons.forEach((p) => { nameOf[p.id] = p.farmlandName; });
        const byDate: Record<string, number[]> = {};
        const byRegion: Record<string, number[]> = {};
        const imgs: { url: string; date: string; land: string }[] = [];
        list.forEach((r: any) => {
          const m = r.ndvi_stats?.mean;
          const date = String(r.date || '').slice(0, 10);
          if (m == null || !date) return;
          (byDate[date] = byDate[date] || []).push(m);
          const nm = nameOf[String(r._localFieldId || '')] || '';
          const reg = nm.slice(0, 2);
          if (reg) (byRegion[reg] = byRegion[reg] || []).push(m);
          if (r.ndvi_field_view_url && imgs.length < 4 && !imgs.some((x) => x.land === nm)) {
            imgs.push({ url: r.ndvi_field_view_url, date, land: nm });
          }
        });
        const days = Object.keys(byDate).sort();
        const last30 = days.slice(-30);
        setView({
          series: last30.map((d) => ({ d: d.slice(5), v: Math.round((byDate[d].reduce((a, b) => a + b, 0) / byDate[d].length) * 1000) / 1000 })),
          regions: Object.entries(byRegion)
            .map(([name, arr]) => ({ name, v: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 1000) / 1000 }))
            .sort((a, b) => b.v - a.v),
          imgs,
        });
      })
      .catch(() => {});
  }, [siteKey, polygons.length]);

  useEffect(() => {
    if (!view?.imgs.length) return;
    const t = setInterval(() => setImgIdx((i) => (i + 1) % view.imgs.length), 5000);
    return () => clearInterval(t);
  }, [view]);

  if (!view || view.series.length < 2) {
    return <div className="mod-ph"><div className="mod-ph-icon" /><div>卫星长势数据加载中…</div></div>;
  }
  const vs = view.series.map((x) => x.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const pts = view.series.map((x, i) => {
    const px = 6 + (i / (view.series.length - 1)) * 288;
    const py = 74 - ((x.v - min) / span) * 56;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');
  const cur = view.series[view.series.length - 1];

  return (
    <div className="ndvi-wrap">
      <div className="ndvi-chart">
        <svg viewBox="0 0 300 92" preserveAspectRatio="none" className="ndvi-svg">
          <polygon points={`6,92 ${pts} 294,92`} fill="rgba(52,211,153,.18)" />
          <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="294" cy={74 - ((cur.v - min) / span) * 56} r="3" fill="#fbbf24" />
        </svg>
        <div className="ndvi-cur">
          近30天均值 <b style={{ color: '#fbbf24' }}>{cur.v.toFixed(3)}</b>
        </div>
      </div>
      <div className="ndvi-regions">
        {view.regions.slice(0, 7).map((r) => (
          <div key={r.name} className="ndvi-reg">
            <span className="ndvi-reg-name">{r.name}</span>
            <div className="ndvi-reg-bar"><div style={{ width: `${((r.v - 0.4) / 0.35) * 100}%` }} /></div>
            <span className="ndvi-reg-v">{r.v.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {view.imgs.length > 0 && (
        <div className="ndvi-img">
          <img src={view.imgs[imgIdx].url} alt="" />
          <span className="ndvi-img-cap">{view.imgs[imgIdx].land} · {view.imgs[imgIdx].date}</span>
        </div>
      )}
    </div>
  );
};

const CameraPanel = ({
  cameras,
  idx,
  onSelect,
}: {
  cameras: Camera[] | null;
  idx: number;
  onSelect: (i: number) => void;
}) => {
  if (!cameras || cameras.length === 0) {
    return (
      <div className="mod-ph">
        <div className="mod-ph-icon" />
        <div>摄像头数据加载中…</div>
      </div>
    );
  }
  const cur = cameras[Math.min(idx, cameras.length - 1)];
  const online = cur.status === 1 && !!cur.hls;
  return (
    <div className="cam-single">
      <div className="cam-video">
        {online ? (
          <HlsPlayer src={cur.hls} cameraName={cur.name} />
        ) : (
          <div className="cam-offline">
            <span>设备离线</span>
          </div>
        )}
        {online && <span className="cam-live on">LIVE</span>}
        <span className="cam-name">{cur.name}</span>
      </div>
      <div className="cam-switch">
        {cameras.map((c, i) => (
          <button key={c.id} className={`cam-btn ${i === idx ? 'act' : ''}`} onClick={() => onSelect(i)}>
            {c.name}
            {c.status !== 1 && <span className="cam-btn-off">离线</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ---------- 虫情面板（三灯总量 + 害虫排行 + AI图轮播） ---------- */
const PESTS = ['斜纹夜蛾', '黏虫', '烟青虫', '棉铃虫', '蚜虫', '甜菜夜蛾', '小菜蛾', '玉米螟', '二化螟', '稻纵卷叶螟', '草地贪夜蛾'];
const InsectPanel = ({ baseId, insectLands }: { baseId: number | null; insectLands: string[] }) => {
  const [total, setTotal] = useState<number | null>(null);
  const [top, setTop] = useState<{ name: string; v: number }[]>([]);
  const [imgs, setImgs] = useState<{ ai: string; orig: string; time: string }[]>([]);
  const [imgIdx, setImgIdx] = useState(0);
  const [wallOff, setWallOff] = useState(0);
  const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';

  useEffect(() => {
    if (!baseId || insectLands.length === 0) return;
    (async () => {
      try {
        const rs = await Promise.allSettled(
          insectLands.slice(0, 3).map((fid) =>
            fetch('/api/collect/iot/getInsectStatistics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Site-Name': siteKey },
              body: JSON.stringify({ farmlandId: fid, startTime: '2026-01-01 00:00:00', endTime: '2026-12-31 23:59:59' }),
            }).then((r) => r.json())
          )
        );
        const merged: Record<string, number> = {};
        let sum = 0;
        rs.forEach((r) => {
          if (r.status !== 'fulfilled' || r.value?.code !== 200) return;
          const d = r.value.data;
          if (!d || typeof d !== 'object') return;
          sum += Number(d.total || 0);
          (Array.isArray(d.insect) ? d.insect : []).forEach((sp: Record<string, unknown>) => {
            const n = String(sp.insectName || '');
            const v = Number(sp.insectValue || 0);
            if (n) merged[n] = (merged[n] || 0) + v;
          });
        });
        setTotal(sum);
        setTop(Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, v]) => ({ name, v })));
      } catch {}
    })();
    (async () => {
      try {
        const r = await fetch('/api/collect/iot/getInsectImages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Site-Name': siteKey },
          body: JSON.stringify({ farmlandId: insectLands[0], startTime: '2026-01-01 00:00:00', endTime: '2026-12-31 23:59:59' }),
        });
        const d = await r.json();
        const list = Array.isArray(d.data?.images) ? d.data.images : [];
        const n = list.length;
        const picked = Array.from({ length: 8 }, (_, i) => list[Math.min(n - 1, Math.floor((i * (n - 1)) / 7))]);
        setImgs(
          picked.reverse().map((x: Record<string, unknown>) => ({
            ai: String(x.imageResult || x.image || ''),
            orig: String(x.image || x.imageResult || ''),
            time: String(x.reportTime || '').slice(0, 16),
          }))
        );
      } catch {}
    })();
  }, [baseId, insectLands.length, siteKey]);

  useEffect(() => {
    if (!imgs.length) return;
    const t = setInterval(() => {
      setImgIdx((i) => (i + 1) % imgs.length);
      setWallOff((o) => (o + 1) % imgs.length);
    }, 5000);
    return () => clearInterval(t);
  }, [imgs]);

  const maxV = Math.max(1, ...top.map((t) => t.v));
  return (
    <div className="ins-wrap">
      <div className="ins-total">
        累计诱虫 <b>{total != null ? total.toLocaleString() : '—'}</b> 只
      </div>
      <div className="ins-top">
        {top.length === 0 ? (
          <div className="mod-ph"><div className="mod-ph-icon" /><div>虫情数据加载中…</div></div>
        ) : (
          top.map((t) => {
            const isPest = PESTS.some((p) => t.name.includes(p));
            return (
              <div key={t.name} className="ins-row">
                <span className="ins-name" title={t.name}>{t.name}</span>
                <div className="ins-bar"><div style={{ width: `${(t.v / maxV) * 100}%`, background: isPest ? 'linear-gradient(90deg,#7f1d1d,#f87171)' : 'linear-gradient(90deg,#0e5c33,#34d399)' }} /></div>
                <span className="ins-v" style={{ color: isPest ? '#f87171' : '#9fd6bb' }}>{t.v}</span>
              </div>
            );
          })
        )}
      </div>
      {imgs.length > 0 && (
        <div className="ins-wall">
          {[...imgs.slice(wallOff), ...imgs.slice(0, wallOff)].slice(0, 6).map((im, i) => (
            <div key={`${im.time}-${i}`} className={`ins-cell ${i === 0 ? 'big' : ''}`}>
              <img src={i === 0 ? im.ai : im.orig} alt="" />
              <span>{im.time.slice(5, 10)}{i === 0 ? ' ·AI' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- 农事模块（近期任务滚动 + 2027节点倒计时） ---------- */
const FarmPanel = ({ baseId }: { baseId: number | null }) => {
  const [tasks, setTasks] = useState<{ name: string; time: string; land: string }[] | null>(null);
  const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';

  useEffect(() => {
    if (!baseId) return;
    fetch('/api/farm/work/queryWorkTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Site-Name': siteKey },
      body: JSON.stringify({ baseId, startTime: '2026-01-01 00:00:00', endTime: '2026-12-31 23:59:59', pageNum: 1, pageSize: 100 }),
    })
      .then((r) => r.json())
      .then((d) => {
        const rows = Array.isArray(d.data?.rows) ? d.data.rows : [];
        setTasks(
          rows
            .map((t: Record<string, unknown>) => ({
              name: String(t.taskName || ''),
              time: String(t.scheduledStartTime || '').slice(0, 10),
              land: String(t.landName || ''),
            }))
            .sort((a: { time: string }, b: { time: string }) => b.time.localeCompare(a.time))
            .slice(0, 10)
        );
      })
      .catch(() => {});
  }, [baseId, siteKey]);

  const now = new Date();
  const dayOf = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / 86400000);
  const countdowns = [
    { label: '定植窗口', target: new Date('2027-04-20'), tip: '对标罗田早定植20天' },
    { label: '采摘窗口', target: new Date('2027-08-25'), tip: '8月下旬启动抢收' },
  ];

  return (
    <div className="farm-wrap">
      <div className="farm-cd">
        {countdowns.map((c) => {
          const days = dayOf(c.target);
          return (
            <div key={c.label} className="farm-cd-item">
              <span className="farm-cd-label">{c.label}</span>
              <b>{days > 0 ? `${days} 天` : '已开启'}</b>
              <span className="farm-cd-tip">{c.tip}</span>
            </div>
          );
        })}
      </div>
      <div className="farm-list">
        {!tasks ? (
          <div className="mod-ph"><div className="mod-ph-icon" /><div>农事数据加载中…</div></div>
        ) : (
          tasks.map((t, i) => (
            <div key={i} className="farm-row">
              <span className="farm-dot" />
              <span className="farm-name">{t.name}</span>
              <span className="farm-land">{t.land}</span>
              <span className="farm-time">{t.time.slice(5)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/* ---------- 子组件 ---------- */
const KpiBar = ({ segs }: { segs: { pct: number; color: string }[] }) => (
  <div className="kpi-bar">
    {segs.map((s, i) => (
      <div key={i} style={{ width: `${s.pct}%`, background: s.color }} />
    ))}
  </div>
);

const KpiCard = ({
  label, value, unit, sub, color, delay, children,
}: {
  label: string; value: string; unit?: string; sub?: string; color: string; delay: number; children?: ReactNode;
}) => (
  <div className="kpi-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value" style={{ color }} key={value}>
      {value}
      {unit && <span className="kpi-unit">{unit}</span>}
    </div>
    {sub && <div className="kpi-sub">{sub}</div>}
    {children}
  </div>
);

const Mod = ({
  title, badge, children, className, extra,
}: {
  title: string; badge?: string; children?: ReactNode; className?: string; extra?: ReactNode;
}) => (
  <div className={`mod ${className || ''}`}>
    <div className="mod-hd">
      <span className="mod-title">{title}</span>
      <div className="mod-hd-right">
        {extra}
        {badge && <span className="mod-badge">{badge}</span>}
      </div>
    </div>
    <div className="mod-bd">{children}</div>
  </div>
);

const Placeholder = ({ text }: { text: string }) => (
  <div className="mod-ph"><div className="mod-ph-icon" /><div>{text}</div></div>
);

/* ---------- 主页面 ---------- */
export const DashboardPage = () => {
  const [params] = useSearchParams();
  const siteKey = params.get('site') || 'base-current';

  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [isPhone, setIsPhone] = useState(false);
  const [portraitMode, setPortraitMode] = useState(false);

  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(2026);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [baseId, setBaseId] = useState<number | null>(null);
  const [live, setLive] = useState<{ devices?: number; cameras?: number }>({});
  const [baseName, setBaseName] = useState('重庆药用高辣度辣椒基地');
  const [polygons, setPolygons] = useState<LandPoly[]>([]);
  const [wgsCenter, setWgsCenter] = useState<[number, number]>();
  const [devices, setDevices] = useState<DeviceMarker[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>();
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [camIdx, setCamIdx] = useState(0);
  const [showMain, setShowMain] = useState<'map' | 'cam'>('map');

  const switchMain = (m: 'map' | 'cam') => {
    setShowMain(m);
  };

  const handleDeviceClick = (d: DeviceMarker) => {
    if (d.type !== 'camera' || !cameras) return;
    const i = cameras.findIndex(
      (c) => c.name === d.name || c.name.includes(d.name) || d.name.includes(c.name)
    );
    if (i >= 0) {
      setCamIdx(i);
      switchMain('cam');
    }
  };

  const clock = useClock();

  /* 尺寸与模板 */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
      setIsPhone(Math.min(window.innerWidth, window.innerHeight) < 768);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  /* 模板变化后重绘地图 */
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize?.(), 350);
    return () => clearTimeout(t);
  }, [dims, templateOf(dims.w, dims.h, isPhone)]);

  /* 基地信息 + 年份列表 + 快照 */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/site-binding?site=${encodeURIComponent(siteKey)}`);
        const d = await r.json();
        if (d.binding?.siteName) setBaseName(d.binding.siteName);
        if (d.binding?.baseId) setBaseId(Number(d.binding.baseId));
      } catch {}
    })();
    (async () => {
      try {
        const r = await fetch(`/reports/index.json?_t=${Date.now()}`);
        const list = (await r.json()) as AnnualReport[];
        const ys = list
          .filter((x) => x.type === 'annual' && x.year)
          .map((x) => x.year as number)
          .sort((a, b) => b - a);
        if (ys.length) {
          setYears(ys);
          setYear(ys[0]);
        }
      } catch {}
    })();
  }, [siteKey]);

  useEffect(() => {
    if (!year) return;
    (async () => {
      try {
        const r = await fetch(`/reports/dashboard/${year}.json?_t=${Date.now()}`);
        if (r.ok) setSnap((await r.json()) as Snapshot);
        else setSnap(null);
      } catch {
        setSnap(null);
      }
    })();
  }, [year]);

  /* 地块 + 设备 + 摄像头（与总览页 MapSection 同解析逻辑） */
  useEffect(() => {
    if (!baseId) return;
    (async () => {
      try {
        const [landRes, iotRes] = await Promise.all([
          fetch(`/api/farm/land/list?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } }).then((r) => r.json()),
          fetch(`/api/collect/iot/locationList?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } }).then((r) => r.json()),
        ]);

        const parsed: LandPoly[] = [];
        if (landRes.code === 200 && Array.isArray(landRes.data)) {
          let wSumX = 0, wSumY = 0, wN = 0;
          landRes.data.forEach((land: Record<string, unknown>) => {
            const wkt = String(land.mapPolygonGeo || '');
            const m = /POLYGON\(\(([^)]+)\)\)/.exec(wkt);
            if (!m) return;
            const rawPts = m[1].split(',').map((p) => {
              const [lng, lat] = p.trim().split(/\s+/).map(Number);
              return [lng, lat] as [number, number];
            });
            rawPts.forEach((c) => { wSumX += c[0]; wSumY += c[1]; wN++; });
            const coords = rawPts
              .map((c) => wgs84ToGcj02(c[0], c[1]) as [number, number])
              .filter((c) => !Number.isNaN(c[0]) && !Number.isNaN(c[1]));
            if (coords.length < 3) return;
            const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
            const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
            if (wN > 0) setWgsCenter([wSumX / wN, wSumY / wN]);
            parsed.push({
              id: String(land.id),
              farmlandName: String(land.farmlandName || ''),
              size: Number(land.size || 0),
              backgroundColor: String(land.backgroundColor || '#10b981'),
              borderColor: String(land.borderColor || '#059669'),
              transparency: Number(land.transparency ?? 30),
              borderWidth: Number(land.borderWidth ?? 2),
              coordinates: coords,
              centroid: [cx, cy],
            });
          });
          setPolygons(parsed);

          let center: [number, number] | undefined;
          if (parsed.length > 0) {
            let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
            parsed.forEach((p) =>
              p.coordinates.forEach((c) => {
                minLng = Math.min(minLng, c[0]); maxLng = Math.max(maxLng, c[0]);
                minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
              })
            );
            center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
            setMapCenter(center);
          }

          /* 设备：与 MapSection 同名匹配+偏移散开 */
          if (iotRes.code === 200 && Array.isArray(iotRes.data)) {
            const centroids = new Map<string, [number, number]>();
            parsed.forEach((p) => centroids.set(p.id, p.centroid));
            const landCount = new Map<string, number>();
            const matchLand = (devName: string): string | null => {
              const n = devName.toLowerCase();
              const numMatch = n.match(/(\d+)号/);
              const num = numMatch ? numMatch[1] : '';
              for (const p of parsed) {
                const lname = p.farmlandName.toLowerCase();
                if (n.includes('新元') && num === '1' && lname.includes('新元') && lname.includes('1号')) return p.id;
                if (n.includes('新元') && num === '2' && lname.includes('新元') && lname.includes('2号')) return p.id;
                if (n.includes('关坪') && lname.includes('关坪') && lname.includes('1号')) return p.id;
              }
              for (const p of parsed) {
                const lname = p.farmlandName.toLowerCase();
                if (n.includes('新元') && lname.includes('新元') && lname.includes('1号')) return p.id;
                if (n.includes('关坪') && lname.includes('关坪')) return p.id;
              }
              return null;
            };
            const offsets: [number, number][] = [[0, 0], [0.0006, 0], [0, -0.0006], [-0.0006, 0], [0, 0.0006]];
            const markers: DeviceMarker[] = iotRes.data.map((iot: Record<string, unknown>) => {
              const name = String(iot.name || '');
              const fid = matchLand(name);
              let position: [number, number] = [0, 0];
              const centroid = fid ? centroids.get(fid) : undefined;
              if (centroid) {
                const count = landCount.get(fid!) || 0;
                landCount.set(fid!, count + 1);
                const [ox, oy] = offsets[count] || [0, 0];
                position = [centroid[0] + ox, centroid[1] + oy];
              } else if (center) {
                position = [center[0], center[1]];
              }
              const n = name.toLowerCase();
              let type: DeviceMarker['type'] = 'weather';
              if (n.includes('虫')) type = 'insect';
              else if (n.includes('摄像') || n.includes('监控') || n.includes('球机')) type = 'camera';
              return {
                id: String(iot.id),
                type,
                name: name || `设备 ${iot.id}`,
                position,
                status: iot.is_used === 1 ? 'online' : 'offline',
                farmlandId: fid || undefined,
              };
            });
            setDevices(markers);
          }
        }
      } catch {}
    })();
    (async () => {
      try {
        const lr = await fetch(`/api/farm/land/list?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } });
        const ld = await lr.json();
        const fids = Array.isArray(ld.data) ? ld.data.map((l: Record<string, unknown>) => String(l.id)).join(',') : '';
        if (!fids) return;
        const r = await fetch('/api/collect/collection/cameraList', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Site-Name': siteKey },
          body: JSON.stringify({ baseId, farmlandIds: fids }),
        });
        const d = await r.json();
        if (d.code === 200 && Array.isArray(d.data)) {
          setCameras(
            d.data.map((c: Record<string, unknown>) => ({
              id: String(c.id),
              name: String(c.cameraName || '摄像头'),
              hls: String(c.hls || ''),
              status: Number(c.status ?? 0),
            }))
          );
        }
      } catch {}
    })();
  }, [baseId, siteKey]);

  /* 实时设备/摄像头计数（快照兜底） */
  useEffect(() => {
    if (!baseId) return;
    const load = async () => {
      try {
        const [dev, cam] = await Promise.allSettled([
          fetch(`/api/collect/iot/getCountByType?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } }).then((r) => r.json()),
          fetch(`/api/collect/camera/count?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } }).then((r) => r.json()),
        ]);
        const devCount =
          dev.status === 'fulfilled' && Array.isArray(dev.value?.data)
            ? dev.value.data.reduce((s: number, t: { count?: number }) => s + (t.count || 0), 0)
            : undefined;
        const camCount = cam.status === 'fulfilled' && cam.value?.data != null ? Number(cam.value.data) : undefined;
        setLive({ devices: devCount, cameras: camCount });
      } catch {}
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [baseId, siteKey]);

  /* rem 缩放基准：基于窗口尺寸（不依赖容器测量时序），设在根元素 */
  useEffect(() => {
    const apply = () => {
      const scale = Math.min(1.5, Math.max(0.6, Math.min(window.innerWidth, window.innerHeight) / 720));
      document.documentElement.style.fontSize = `${scale * 16}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      document.documentElement.style.fontSize = '';
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  /* 地图初始化期自适应（AMap 异步加载，轮询 resize 直到就绪） */
  useEffect(() => {
    if (!mapCenter) return;
    const t = setInterval(() => mapRef.current?.resize?.(), 1500);
    const stop = setTimeout(() => clearInterval(t), 15000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [mapCenter]);

  const kpi = snap?.kpi;
  const template = templateOf(dims.w, dims.h, isPhone);
  const winPortrait = typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false;
  const rotate = isPhone && !portraitMode && winPortrait;

  const vArea = useCountUp(kpi?.area ?? 0, 1);
  const vLand = useCountUp(kpi?.landCount ?? 0);
  const vDev = useCountUp(live.devices ?? kpi?.devices ?? 0);
  const vCam = useCountUp(live.cameras ?? kpi?.cameras ?? 0);
  const vBench = useCountUp(kpi?.benchmarkYield ?? 0, 2);

  const mainSwitch = (template === 'E' && (
    <div className="main-switch">
      <button className={showMain === 'map' ? 'act' : ''} onClick={() => switchMain('map')}>地图</button>
      <button className={showMain === 'cam' ? 'act' : ''} onClick={() => switchMain('cam')}>监控</button>
    </div>
  ));

  const insectLands = devices.filter((d) => d.type === 'insect' && d.farmlandId).map((d) => d.farmlandId as string);
  const benchmarkMarkers: DeviceMarker[] = (() => {
    const lt = polygons.filter((p) => p.farmlandName.includes('罗田'));
    if (!lt.length) return [];
    const big = lt.reduce((a, b) => (b.size > a.size ? b : a));
    return [{ id: 'benchmark-luotian', type: 'benchmark' as DeviceMarker['type'], name: '罗田标杆区', position: big.centroid, status: 'online' }];
  })();
  const mapDevices = [...devices, ...benchmarkMarkers];
  const mapSection = (
    <section className="area-map">
      <Mod
        title="地块分布全景"
        badge={polygons.length ? `${polygons.length} 块 · 点击摄像头图标切换监控` : undefined}
        className="mod-map"
        extra={mainSwitch}
      >
        <MapPanel polygons={polygons} devices={mapDevices} center={mapCenter} mapRef={mapRef} onDeviceClick={handleDeviceClick} />
      </Mod>
    </section>
  );
  const camSection = (
    <section className="area-cam">
      <Mod title="实时监控 · 全景放大" badge={cameras ? `${cameras.length} 路` : undefined} className="mod-cam" extra={mainSwitch}>
        <CameraPanel cameras={cameras} idx={camIdx} onSelect={(i) => setCamIdx(i)} />
      </Mod>
    </section>
  );
  const wthSection = (
    <section className="area-wth">
      <Mod title="气象环境" className="mod-wth">
        <WeatherPanel firstLandId={polygons[0]?.id} wgsCenter={wgsCenter} kpi={kpi} />
      </Mod>
    </section>
  );
  const insSection = (
    <section className="area-ins">
      <Mod title="虫情监测" badge="AI识别" className="mod-ins">
        <InsectPanel baseId={baseId} insectLands={insectLands.length ? insectLands : polygons[0] ? [polygons[0].id] : []} />
      </Mod>
    </section>
  );
  const farmSection = (
    <section className="area-farm">
      <Mod title="农事动态" badge="2027 倒计时" className="mod-farm">
        <FarmPanel baseId={baseId} />
      </Mod>
    </section>
  );
  const ndviSection = (
    <section className="area-ndvi">
      <Mod title="长势 NDVI" badge="30天" className="mod-ndvi">
        <NdviPanel polygons={polygons} />
      </Mod>
    </section>
  );

  return (
    <div className={`dash-root ${rotate ? 'dash-rotated' : ''}`} ref={rootRef}>
      <div className="dash-bg" />
      <div className="dash-inner" data-template={template}>
        {/* ===== 顶栏 ===== */}
        <header className="dash-top">
          <div className="dash-brand">
            <div className="dash-logo" />
            <div>
              <div className="dash-name">{baseName}</div>
              <div className="dash-slogan">{snap?.value.headline || '数字农业基地全景监控'}</div>
            </div>
          </div>
          <div className="dash-top-right">
            <div className="dash-clock">
              <span className="dash-time">{clock.time}</span>
              <span className="dash-date">{clock.date}</span>
            </div>
            {years.length > 0 && (
              <div className="dash-year">
                <div className="dash-year-select">
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y} 年
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </div>
              </div>
            )}
            {isPhone && (
              <button
                className="dash-orient"
                onClick={() => setPortraitMode((p) => !p)}
                title={portraitMode ? '切换横屏' : '切换竖屏'}
              >
                {portraitMode ? <RotateCw size={15} /> : <RotateCcw size={15} />}
                {portraitMode ? '横屏' : '竖屏'}
              </button>
            )}
          </div>
        </header>

        {/* ===== 主体（按模板重排） ===== */}
        <main className={`dash-main t-${template}`}>
          <section className="area-kpi">
            <KpiCard
              label={`标杆亩产 · ${kpi?.benchmarkRegion || '罗田'}`}
              value={String(vBench)}
              unit="吨/亩"
              sub="早定植20天 + 精细管理"
              color="#fbbf24"
              delay={80}
            >
              <KpiBar segs={[{ pct: 33, color: '#0e5c33' }, { pct: 67, color: '#fbbf24' }]} />
              <div className="kpi-note">基地平均 0.25 → 标杆 0.5</div>
            </KpiCard>
            <KpiCard label="种植面积" value={String(vArea)} unit="亩" sub={`${kpi?.landCount || '—'} 块地 · ${kpi?.regionCount || '—'} 个区域`} color="#34d399" delay={160}>
              <KpiBar
                segs={[
                  { pct: 28, color: '#fbbf24' }, { pct: 25, color: '#a78bfa' }, { pct: 18, color: '#38bdf8' },
                  { pct: 10, color: '#f87171' }, { pct: 9, color: '#f59e0b' }, { pct: 7, color: '#2dd4bf' }, { pct: 3, color: '#f472b6' },
                ]}
              />
              <div className="kpi-note">罗田 97.1 亩最大 · 紫水 85.1</div>
            </KpiCard>
            <KpiCard label="地块数量" value={String(vLand)} unit="块" sub="卫星遥感全覆盖" color="#34d399" delay={240}>
              <KpiBar segs={[{ pct: 100, color: 'linear-gradient(90deg,#0e5c33,#34d399)' }]} />
              <div className="kpi-note">28/28 遥感覆盖</div>
            </KpiCard>
            <KpiCard label="IoT 设备" value={String(vDev)} unit="台" sub="气象站·虫情灯·摄像头" color="#38bdf8" delay={320}>
              <KpiBar segs={[{ pct: 14, color: '#38bdf8' }, { pct: 43, color: '#a78bfa' }, { pct: 43, color: '#f87171' }]} />
              <div className="kpi-note">气象 1 · 虫情 3 · 摄像 3</div>
            </KpiCard>
            <KpiCard label="摄像头在线" value={String(vCam)} unit="路" sub="萤石云 HLS 直播" color="#f87171" delay={400}>
              <KpiBar segs={[{ pct: 100, color: 'linear-gradient(90deg,#7f1d1d,#f87171)' }]} />
              <div className="kpi-note">3/3 在线 · LIVE</div>
            </KpiCard>
            <KpiCard label="目标亩产" value={`${kpi?.targetYield?.[0] ?? '—'}–${kpi?.targetYield?.[1] ?? '—'}`} unit="kg/亩" sub={`2026 实绩 ${kpi?.yieldActual ?? '—'} kg`} color="#a78bfa" delay={480}>
              <div className="ladder">
                {[kpi?.yieldActual ?? 0, kpi?.targetYield?.[0] ?? 0, kpi?.targetYield?.[1] ?? 0].map((v, i) => (
                  <div key={i} className={`ladder-bar l${i}`} style={{ height: `${Math.min(100, (v / 700) * 100)}%` }} title={`${v} kg`} />
                ))}
                <div className="ladder-axis">
                  <span>实绩</span>
                  <span>目标低</span>
                  <span>目标高</span>
                </div>
              </div>
            </KpiCard>
          </section>

          {template === 'E' ? (
            <>
              {showMain === 'map' ? mapSection : camSection}
              {wthSection}
              {insSection}
            </>
          ) : (
            <>
              {mapSection}
              {camSection}
              {wthSection}
              {ndviSection}
              {insSection}
              {farmSection}
            </>
          )}

          <section className="area-value">
            <Mod title="产业价值 · 发展前景" badge={`${year} 年数据`} className="mod-value">
              <div className="value-strip">
                <div className="value-chain">
                  {snap?.value.chain.map((c, i) => (
                    <div key={i} className="chain-node">
                      <span className="chain-dot" style={{ animationDelay: `${i * 300}ms` }} />
                      <span className="chain-text">{c}</span>
                      {i < (snap?.value.chain.length || 1) - 1 && <span className="chain-arrow">→</span>}
                    </div>
                  ))}
                </div>
                <div className="value-nums">
                  <div className="value-num">
                    <span className="value-num-label">目标亩产</span>
                    <b>{kpi?.targetYield?.[0] ?? '—'}–{kpi?.targetYield?.[1] ?? '—'}<i>kg/亩</i></b>
                    <span className="value-num-tip">2027 年攻坚目标</span>
                  </div>
                  <div className="value-num">
                    <span className="value-num-label">保本亩产</span>
                    <b>{kpi?.breakeven ?? '—'}<i>kg/亩</i></b>
                    <span className="value-num-tip">成本控制线</span>
                  </div>
                  <div className="value-num">
                    <span className="value-num-label">标杆亩产值</span>
                    <b>{(kpi?.benchmarkRevenue ?? 0).toLocaleString()}<i>元/亩</i></b>
                    <span className="value-num-tip">罗田 0.5 吨 × 6 元</span>
                  </div>
                </div>
              </div>
            </Mod>
          </section>
        </main>
      </div>
    </div>
  );
};
