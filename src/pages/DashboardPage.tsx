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
    <MapComponent
      ref={mapRef}
      isFullScreen={false}
      center={center}
      polygon={[]}
      polygons={polygons}
      devices={devices}
      onDeviceClick={onDeviceClick}
    />
  );
};

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
  title, badge, children, className,
}: {
  title: string; badge?: string; children?: ReactNode; className?: string;
}) => (
  <div className={`mod ${className || ''}`}>
    <div className="mod-hd">
      <span className="mod-title">{title}</span>
      {badge && <span className="mod-badge">{badge}</span>}
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
  const [devices, setDevices] = useState<DeviceMarker[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>();
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [camIdx, setCamIdx] = useState(0);
  const [showMain, setShowMain] = useState<'map' | 'cam'>('map');

  const handleDeviceClick = (d: DeviceMarker) => {
    if (d.type !== 'camera' || !cameras) return;
    const i = cameras.findIndex(
      (c) => c.name === d.name || c.name.includes(d.name) || d.name.includes(c.name)
    );
    if (i >= 0) {
      setCamIdx(i);
      setShowMain('cam');
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
          landRes.data.forEach((land: Record<string, unknown>) => {
            const wkt = String(land.mapPolygonGeo || '');
            const m = /POLYGON\(\(([^)]+)\)\)/.exec(wkt);
            if (!m) return;
            const coords = m[1]
              .split(',')
              .map((p) => {
                const [lng, lat] = p.trim().split(/\s+/).map(Number);
                return wgs84ToGcj02(lng, lat) as [number, number];
              })
              .filter((c) => !Number.isNaN(c[0]) && !Number.isNaN(c[1]));
            if (coords.length < 3) return;
            const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
            const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
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

  /* E 模板：地图/摄像头主位轮换 */
  useEffect(() => {
    const template = templateOf(dims.w, dims.h, isPhone);
    if (template !== 'E') return;
    const t = setInterval(() => setShowMain((m) => (m === 'map' ? 'cam' : 'map')), 20000);
    return () => clearInterval(t);
  }, [dims]);

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

  const mapSection = (
    <section className="area-map">
      <Mod
        title="地块分布全景"
        badge={polygons.length ? `${polygons.length} 块 · 点击摄像头图标切换监控` : undefined}
        className="mod-map"
      >
        <MapPanel polygons={polygons} devices={devices} center={mapCenter} mapRef={mapRef} onDeviceClick={handleDeviceClick} />
      </Mod>
    </section>
  );
  const camSection = (
    <section className="area-cam">
      <Mod title="实时监控 · 全景放大" badge={cameras ? `${cameras.length} 路` : undefined} className="mod-cam">
        <CameraPanel cameras={cameras} idx={camIdx} onSelect={(i) => setCamIdx(i)} />
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
                <span className="dash-year-label">年度</span>
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
              {showMain === 'map' ? mapSection : camSection}
              <section className="area-wth">
                <Mod title="气象环境" badge="P3">
                  <Placeholder text="气象站实时 + 7日预报 · P3 上线" />
                </Mod>
              </section>
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
              <section className="area-wth">
                <Mod title="气象环境" badge="P3">
                  <Placeholder text="气象站实时 + 7日预报 · P3 上线" />
                </Mod>
              </section>
              <section className="area-ndvi">
                <Mod title="长势 NDVI" badge="P3">
                  <Placeholder text="生长曲线 + 分区对比 · P3 上线" />
                </Mod>
              </section>
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
