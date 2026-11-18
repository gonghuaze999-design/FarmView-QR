import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, RotateCcw, RotateCw } from 'lucide-react';
import { HlsPlayer } from '../components/CameraTab';
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
interface Land {
  id: string;
  name: string;
  size: number;
  region: string;
  pts: [number, number][];
  cx: number;
  cy: number;
}
interface Device {
  id: string;
  name: string;
  type: 'weather' | 'insect' | 'camera';
  land: string;
}
interface Camera {
  id: string;
  name: string;
  hls: string;
  status: number;
}

const REGION_RULES: [string, string][] = [
  ['新元村', '新元'], ['关坪', '关坪'], ['罗田', '罗田'], ['大进', '大进'],
  ['紫水', '紫水'], ['大德', '大德'], ['和谦', '和谦'],
];
const REGION_COLORS: Record<string, string> = {
  罗田: '#34d399', 新元: '#38bdf8', 关坪: '#f87171', 紫水: '#a78bfa',
  和谦: '#fbbf24', 大德: '#2dd4bf', 大进: '#f472b6',
};
const regionOf = (name: string) => {
  for (const [k, v] of REGION_RULES) if (name.includes(k)) return v;
  return '其他';
};
const wktPoly = (w?: string | null): [number, number][] | null => {
  const m = /POLYGON\(\(([^)]+)\)\)/.exec(w || '');
  if (!m) return null;
  return m[1].split(',').map((p) => {
    const q = p.trim().split(/\s+/);
    return [parseFloat(q[0]), parseFloat(q[1])];
  });
};

/* ---------- hooks ---------- */
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
const templateOf = (w: number, h: number): Template => {
  if (w === 0 || h === 0) return 'A';
  const ar = w / h;
  if (ar >= 1.9) return 'E';
  if (ar >= 1.55) return 'A';
  if (ar >= 1.35) return 'B';
  if (ar >= 1) return 'C';
  return 'F';
};

/* ---------- 地图（SVG 深色版） ---------- */
const MapPanel = ({ lands, devices }: { lands: Land[] | null; devices: Device[] | null }) => {
  const box = useMemo(() => {
    if (!lands || lands.length === 0) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    lands.forEach((l) =>
      l.pts.forEach(([x, y]) => {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      })
    );
    const padX = (x1 - x0) * 0.06 || 0.01;
    const padY = (y1 - y0) * 0.06 || 0.01;
    return { x: x0 - padX, y: y0 - padY, w: x1 - x0 + padX * 2, h: y1 - y0 + padY * 2 };
  }, [lands]);

  if (!lands || !box) {
    return <div className="mod-ph"><div className="mod-ph-icon" /><div>地块数据加载中…</div></div>;
  }
  // 罗田标杆光环（取罗田最大地块中心）
  let bench: { x: number; y: number } | null = null;
  let benchSize = 0;
  lands.forEach((l) => {
    if (l.region === '罗田' && l.size > benchSize) {
      benchSize = l.size;
      bench = { x: l.cx, y: l.cy };
    }
  });
  // 区域标注（每区域取最大地块）
  const regionCtr: Record<string, { x: number; y: number; size: number }> = {};
  lands.forEach((l) => {
    const c = regionCtr[l.region];
    if (!c || l.size > c.size) regionCtr[l.region] = { x: l.cx, y: l.cy, size: l.size };
  });

  return (
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="dash-map" preserveAspectRatio="xMidYMid meet">
      {lands.map((l) => (
        <g key={l.id}>
          <polygon
            points={l.pts.map((p) => p.join(',')).join(' ')}
            className="map-poly"
            fill={l.region === '罗田' ? 'rgba(52,211,153,.16)' : 'rgba(16,185,129,.10)'}
          >
            <title>{`${l.name} · ${l.size} 亩`}</title>
          </polygon>
        </g>
      ))}
      {lands.map((l) => (
        <circle
          key={`b-${l.id}`}
          cx={l.cx}
          cy={l.cy}
          r={Math.sqrt(l.size) * 0.0016}
          fill={REGION_COLORS[l.region] || '#888'}
          fillOpacity={0.92}
          stroke="#ffffff"
          strokeWidth={0.0008}
        >
          <title>{`${l.name} · ${l.size} 亩`}</title>
        </circle>
      ))}
      {bench && (
        <g>
          <circle cx={bench.x} cy={bench.y} r={Math.sqrt(benchSize) * 0.0016 + 0.008} className="bench-ring" />
          <circle cx={bench.x} cy={bench.y} r={Math.sqrt(benchSize) * 0.0016 + 0.013} className="bench-ring r2" />
        </g>
      )}
      {(devices || []).map((d) => {
        const land = lands.find((l) => l.id === d.land);
        if (!land) return null;
        const color = d.type === 'weather' ? '#38bdf8' : d.type === 'insect' ? '#a78bfa' : '#f87171';
        return (
          <g key={d.id}>
            <rect
              x={land.cx - 0.0035}
              y={land.cy - 0.0035}
              width={0.007}
              height={0.007}
              rx={0.0015}
              fill={color}
              stroke="#0a241b"
              strokeWidth={0.0008}
            >
              <title>{d.name}</title>
            </rect>
          </g>
        );
      })}
      {Object.entries(regionCtr).map(([reg, c]) => (
        <text
          key={reg}
          x={c.x}
          y={c.y - Math.sqrt(c.size) * 0.0016 - 0.004}
          textAnchor="middle"
          className="map-label"
        >
          {reg}
        </text>
      ))}
    </svg>
  );
};

/* ---------- 摄像头 ---------- */
const CameraPanel = ({ cameras }: { cameras: Camera[] | null }) => {
  if (!cameras || cameras.length === 0) {
    return <div className="mod-ph"><div className="mod-ph-icon" /><div>摄像头数据加载中…</div></div>;
  }
  return (
    <div className="cam-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cameras.length, 3)}, 1fr)` }}>
      {cameras.map((c) => (
        <div className="cam-tile" key={c.id}>
          <HlsPlayer src={c.hls} cameraName={c.name} />
          <span className={`cam-live ${c.status === 1 ? 'on' : ''}`}>LIVE</span>
          <span className="cam-name">{c.name}</span>
        </div>
      ))}
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
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [isPhone, setIsPhone] = useState(false);
  const [portraitMode, setPortraitMode] = useState(false);

  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(2026);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [baseId, setBaseId] = useState<number | null>(null);
  const [live, setLive] = useState<{ devices?: number; cameras?: number }>({});
  const [baseName, setBaseName] = useState('重庆药用高辣度辣椒基地');
  const [lands, setLands] = useState<Land[] | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [showMain, setShowMain] = useState<'map' | 'cam'>('map');

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

  /* 地块 + 设备 + 摄像头 */
  useEffect(() => {
    if (!baseId) return;
    (async () => {
      try {
        const r = await fetch(`/api/farm/land/list?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } });
        const d = await r.json();
        if (d.code === 200 && Array.isArray(d.data)) {
          const ls: Land[] = [];
          d.data.forEach((l: Record<string, unknown>) => {
            const pts = wktPoly(String(l.mapPolygonGeo || ''));
            if (!pts || pts.length < 3) return;
            const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
            ls.push({
              id: String(l.id), name: String(l.farmlandName || ''),
              size: Number(l.size || 0), region: regionOf(String(l.farmlandName || '')),
              pts, cx, cy,
            });
          });
          setLands(ls);
        }
      } catch {}
    })();
    (async () => {
      try {
        const r = await fetch(`/api/collect/iot/locationList?baseId=${baseId}`, { headers: { 'X-Site-Name': siteKey } });
        const d = await r.json();
        if (d.code === 200 && Array.isArray(d.data)) {
          const devs: Device[] = d.data.map((x: Record<string, unknown>) => {
            const name = String(x.name || '');
            const type = name.includes('气象') ? 'weather' : name.includes('虫') ? 'insect' : 'camera';
            return { id: String(x.id), name, type, land: '' };
          });
          setDevices(devs);
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
              id: String(c.id), name: String(c.cameraName || '摄像头'),
              hls: String(c.hls || ''), status: Number(c.status ?? 0),
            }))
          );
        }
      } catch {}
    })();
  }, [baseId, siteKey]);

  /* 设备落位：地名匹配地块（新元→新元村1号，关坪→关坪1号…） */
  useEffect(() => {
    if (!lands || !devices) return;
    setDevices(
      devices.map((d) => {
        let matched = '';
        for (const l of lands) {
          const kw = l.name.replace(/村.*|地块|号地|示范地|_地/g, '').slice(0, 2);
          if (kw && d.name.includes(kw)) {
            matched = l.id;
            break;
          }
        }
        return { ...d, land: matched };
      })
    );
  }, [lands]);

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
    const template = templateOf(dims.w, dims.h);
    if (template !== 'E') return;
    const t = setInterval(() => setShowMain((m) => (m === 'map' ? 'cam' : 'map')), 20000);
    return () => clearInterval(t);
  }, [dims]);

  const kpi = snap?.kpi;
  const template = templateOf(dims.w, dims.h);
  const winPortrait = typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false;
  const rotate = isPhone && !portraitMode && winPortrait;
  const scale = Math.min(1.5, Math.max(0.6, Math.min(dims.w, dims.h) / 720));

  const vArea = useCountUp(kpi?.area ?? 0, 1);
  const vLand = useCountUp(kpi?.landCount ?? 0);
  const vDev = useCountUp(live.devices ?? kpi?.devices ?? 0);
  const vCam = useCountUp(live.cameras ?? kpi?.cameras ?? 0);
  const vBench = useCountUp(kpi?.benchmarkYield ?? 0, 2);

  const mapSection = (
    <section className="area-map">
      <Mod title="地块分布全景" badge={lands ? `${lands.length} 块` : undefined} className="mod-map">
        <MapPanel lands={lands} devices={devices} />
      </Mod>
    </section>
  );
  const camSection = (
    <section className="area-cam">
      <Mod title="实时监控" badge={cameras ? `${cameras.length} 路` : undefined} className="mod-cam">
        <CameraPanel cameras={cameras} />
      </Mod>
    </section>
  );

  return (
    <div className={`dash-root ${rotate ? 'dash-rotated' : ''}`} ref={rootRef}>
      <div className="dash-bg" />
      <div className="dash-inner" data-template={template} style={{ fontSize: `${scale * 16}px` }}>
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
