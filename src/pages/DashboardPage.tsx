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
const WeatherPanel = ({ firstLandId, wgsCenter }: { firstLandId?: string; wgsCenter?: [number, number] }) => {
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
  const wind = station ? Number(station['风速']) : null;
  const warnHeat = (fc || []).slice(0, 3).some((f) => f.tmax >= 35);
  const warnRain = (fc || []).slice(0, 3).some((f) => f.rain >= 80);

  const gauge = temp != null ? Math.max(0, Math.min(1, (temp + 10) / 55)) : 0.5;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (0.75 + 0.5 * from);
    const a1 = Math.PI * (0.75 + 0.5 * to);
    const r = 40, cx = 52, cy = 52;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  return (
    <div className="wth-wrap">
      <div className="wth-now">
        <svg viewBox="0 0 104 66" className="wth-gauge">
          <path d={arc(0, 1)} stroke="rgba(16,185,129,.25)" strokeWidth="8" fill="none" strokeLinecap="round" />
          <path d={arc(0, gauge)} stroke="#34d399" strokeWidth="8" fill="none" strokeLinecap="round" />
          <text x="52" y="52" textAnchor="middle" className="wth-temp">{temp != null ? `${temp.toFixed(1)}°` : '—'}</text>
        </svg>
        <div className="wth-meta">
          <span>湿度 {humi != null ? `${humi.toFixed(0)}%` : '—'}</span>
          <span>风速 {wind != null ? `${wind.toFixed(1)} m/s` : '—'}</span>
          <span className="wth-station">{station ? `气象站 ${station['report_time'] || ''}` : '气象站待机'}</span>
        </div>
      </div>
      {warnHeat && <div className="wth-warn r">高温预警：未来3天 ≥35°C</div>}
      {warnRain && <div className="wth-warn b">降雨预警：未来3天降雨概率 ≥80%</div>}
      <div className="wth-fc">
        {(fc || []).map((f, i) => (
          <div key={i} className={`wth-fc-item ${i === 0 ? 'today' : ''}`}>
            <span className="wth-fc-d">{i === 0 ? '今天' : f.d}</span>
            <span className="wth-fc-t">{f.tmax}°<i>{f.tmin}°</i></span>
            <span className="wth-fc-r" style={{ color: f.rain >= 60 ? '#38bdf8' : '#64748b' }}>{f.rain}%</span>
          </div>
        ))}
      </div>
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

/* ---------- 产业价值阶梯（实绩→目标→展望） ---------- */
const ValueLadder = ({ vals }: { vals: { label: string; v: number; gold?: boolean }[] }) => (
  <div className="value-ladder">
    {vals.map((x, i) => (
      <div key={i} className="value-ladder-col">
        <div className="value-ladder-num" style={{ color: x.gold ? '#fbbf24' : '#9fd6bb' }}>{x.v.toLocaleString()}<i>元/亩</i></div>
        <div className="value-ladder-bar" style={{ height: `${(x.v / (vals[vals.length - 1].v || 1)) * 100}%`, background: x.gold ? 'linear-gradient(180deg,#fbbf24,#b45309)' : 'linear-gradient(180deg,#34d399,#0e5c33)' }} />
        <div className="value-ladder-label">{x.label}</div>
      </div>
    ))}
  </div>
);

/* ---------- 摄像头（单窗口 + 切换，离线黑屏） ---------- */
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

/* ---------- 子组件 ---------- */
const KpiCard = ({
  label, value, unit, sub, color, delay, children,
}: {
  label: string; value: string; unit?: string; sub?: string; color: string; delay: number; children?: ReactNode;
}) => (
  <div className="kpi-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value" style={{ color }}>
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
  const [showMain, setShowMain] = useState<'map' | 'cam' | 'ndvi'>('map');

  const switchMain = (m: 'map' | 'cam' | 'ndvi') => {
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

  /* rem 缩放基准：必须设在根元素（rem 只认根字号） */
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.fontSize;
    el.style.fontSize = `${Math.min(1.5, Math.max(0.6, Math.min(dims.w, dims.h) / 720)) * 16}px`;
    return () => {
      el.style.fontSize = prev;
    };
  }, [dims]);

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
      <button className={showMain === 'ndvi' ? 'act' : ''} onClick={() => switchMain('ndvi')}>长势</button>
    </div>
  ));

  const mapSection = (
    <section className="area-map">
      <Mod
        title="地块分布全景"
        badge={polygons.length ? `${polygons.length} 块 · 点击摄像头图标切换监控` : undefined}
        className="mod-map"
        extra={mainSwitch}
      >
        <MapPanel polygons={polygons} devices={devices} center={mapCenter} mapRef={mapRef} onDeviceClick={handleDeviceClick} />
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
        <WeatherPanel firstLandId={polygons[0]?.id} wgsCenter={wgsCenter} />
      </Mod>
    </section>
  );
  const ndviSection = (
    <section className="area-ndvi">
      <Mod title="长势 NDVI" badge="30天" className="mod-ndvi" extra={template === 'E' ? mainSwitch : undefined}>
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
            />
            <KpiCard label="种植面积" value={String(vArea)} unit="亩" sub={`${kpi?.landCount || '—'} 块地 · ${kpi?.regionCount || '—'} 个区域`} color="#34d399" delay={160} />
            <KpiCard label="地块数量" value={String(vLand)} unit="块" sub="卫星遥感全覆盖" color="#34d399" delay={240} />
            <KpiCard label="IoT 设备" value={String(vDev)} unit="台" sub="气象站·虫情灯·摄像头" color="#38bdf8" delay={320} />
            <KpiCard label="摄像头在线" value={String(vCam)} unit="路" sub="萤石云 HLS 直播" color="#f87171" delay={400} />
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
              {showMain === 'map' ? mapSection : showMain === 'cam' ? camSection : ndviSection}
              {wthSection}
              <section className="area-ins">
                <Mod title="虫情监测" badge="P4">
                  <Placeholder text={`本年度累计识别 ${kpi?.insectTotal ?? '—'} 只 · P4 上线`} />
                </Mod>
              </section>
            </>
          ) : (
            <>
              {mapSection}
              {camSection}
              {wthSection}
              {ndviSection}
              <section className="area-ins">
                <Mod title="虫情监测" badge="P4">
                  <Placeholder text={`本年度累计识别 ${kpi?.insectTotal ?? '—'} 只 · P4 上线`} />
                </Mod>
              </section>
              <section className="area-farm">
                <Mod title="农事动态" badge="P4">
                  <Placeholder text={`${kpi?.workTasks ?? '—'} 条农事任务 · P4 上线`} />
                </Mod>
              </section>
            </>
          )}

          <section className="area-value">
            <Mod title="产业价值 · 发展前景" badge={String(year)}>
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
                <ValueLadder
                  vals={[
                    { label: '2026 实绩', v: (kpi?.yieldActual ?? 250) * 6 },
                    { label: '2027 目标', v: (kpi?.targetYield?.[0] ?? 500) * 6 },
                    { label: '2028 展望', v: (kpi?.targetYield?.[1] ?? 600) * 6, gold: true },
                  ]}
                />
                <div className="value-items">
                  {(snap?.value.items || []).slice(0, 4).map((it, i) => (
                    <div key={i} className="value-item">
                      <span className="value-item-label">{it.label}</span>
                      <span className="value-item-text">{it.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Mod>
          </section>
        </main>
      </div>
    </div>
  );
};
