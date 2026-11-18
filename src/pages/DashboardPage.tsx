import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, RotateCcw, RotateCw } from 'lucide-react';
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

/* ---------- 工具 hooks ---------- */
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

/* ---------- 子组件 ---------- */
const KpiCard = ({
  label,
  value,
  unit,
  sub,
  color,
  delay,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  color: string;
  delay: number;
  children?: ReactNode;
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
  title,
  badge,
  children,
  className,
}: {
  title: string;
  badge?: string;
  children?: ReactNode;
  className?: string;
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
  <div className="mod-ph">
    <div className="mod-ph-icon" />
    <div>{text}</div>
  </div>
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
  const [live, setLive] = useState<{ devices?: number; cameras?: number }>({});
  const [baseName, setBaseName] = useState('重庆药用高辣度辣椒基地');

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

  /* 基地 + 年份列表 + 快照 */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/site-binding?site=${encodeURIComponent(siteKey)}`);
        const d = await r.json();
        if (d.binding?.siteName) setBaseName(d.binding.siteName);
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

  /* 实时设备/摄像头计数（快照兜底） */
  useEffect(() => {
    (async () => {
      try {
        const sb = await (await fetch(`/api/site-binding?site=${encodeURIComponent(siteKey)}`)).json();
        const baseId = sb?.binding?.baseId;
        if (!baseId) return;
        const [dev, cam] = await Promise.allSettled([
          fetch(`/api/collect/iot/getCountByType?baseId=${baseId}`, {
            headers: { 'X-Site-Name': siteKey },
          }).then((r) => r.json()),
          fetch(`/api/collect/camera/count?baseId=${baseId}`, {
            headers: { 'X-Site-Name': siteKey },
          }).then((r) => r.json()),
        ]);
        const devCount =
          dev.status === 'fulfilled' && Array.isArray(dev.value?.data)
            ? dev.value.data.reduce((s: number, t: { count?: number }) => s + (t.count || 0), 0)
            : undefined;
        const camCount = cam.status === 'fulfilled' && cam.value?.data != null ? Number(cam.value.data) : undefined;
        setLive({ devices: devCount, cameras: camCount });
      } catch {}
    })();
    const t = setInterval(() => {
      // 实时计数每 60s 刷新一次
    }, 60000);
    return () => clearInterval(t);
  }, [siteKey]);

  const kpi = snap?.kpi;
  const template = templateOf(dims.w, dims.h);
  const winPortrait = typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false;
  const rotate = isPhone && !portraitMode && winPortrait;

  /* 计数动画值 */
  const vArea = useCountUp(kpi?.area ?? 0, 1);
  const vLand = useCountUp(kpi?.landCount ?? 0);
  const vDev = useCountUp(live.devices ?? kpi?.devices ?? 0);
  const vCam = useCountUp(live.cameras ?? kpi?.cameras ?? 0);
  const vBench = useCountUp(kpi?.benchmarkYield ?? 0, 2);

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

          <section className="area-map">
            <Mod title="地块分布" badge="P2">
              <Placeholder text="地图模块 · P2 上线" />
            </Mod>
          </section>

          <section className="area-cam">
            <Mod title="实时监控" badge="P2">
              <Placeholder text="3 路摄像头直播 · P2 上线" />
            </Mod>
          </section>

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
