import React, { useState, useEffect, useCallback } from 'react';
import { Sprout, ImageOff, ZoomIn, X, Loader2 } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { getDroneTaskList, getAlgorithmImages, colorizeImage, analyzeImage, type AnalyzeContext } from '../services/api';

const PREVIEW_COUNT = 10;

const GRADE_STYLE: Record<string, { text: string; badge: string; big: string }> = {
  '优': { text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', big: 'text-emerald-600' },
  '良': { text: 'text-blue-600',    badge: 'bg-blue-50 text-blue-600',       big: 'text-blue-600' },
  '中': { text: 'text-amber-600',   badge: 'bg-amber-50 text-amber-600',     big: 'text-amber-600' },
  '差': { text: 'text-red-500',     badge: 'bg-red-50 text-red-500',         big: 'text-red-500' },
  '—':  { text: 'text-zinc-400',    badge: 'bg-zinc-100 text-zinc-500',      big: 'text-zinc-400' },
};

interface DroneTask {
  id: number;
  taskName: string;
  scheduledStartTime: string;
  status: number;
  landName: string;
  algorithmTaskId: string | null;
  dronePhotoId: string | null;
}

interface TaskDisplay extends DroneTask {
  imageUrl?: string;       // 原始图像 URL
  colorizedB64?: string;   // 赋色后 base64
  stats?: { mode: number; mean: number; std: number };
  aiText?: string;
  aiGrade?: string;
  imageLoading?: boolean;
  aiLoading?: boolean;
  imageError?: boolean;
}

export const AgriMonitoringSection: React.FC<{ selectedYear?: number }> = ({ selectedYear }) => {
  const { binding } = useSiteContext();
  const [tasks, setTasks] = useState<TaskDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const year = selectedYear || (new Date().getMonth() < 6 ? new Date().getFullYear() - 1 : new Date().getFullYear());

  // 加载任务列表
  useEffect(() => {
    if (!binding) return;
    setLoading(true);
    setTasks([]);
    getDroneTaskList(binding.baseId, 1, 100)
      .then(res => {
        if (res.code === 200 && res.data?.rows) {
          const rows: DroneTask[] = res.data.rows
            .filter((t: any) => {
              if (!t.scheduledStartTime) return false;
              return new Date(t.scheduledStartTime).getFullYear() === year;
            })
            .sort((a: DroneTask, b: DroneTask) =>
              (b.scheduledStartTime || '').localeCompare(a.scheduledStartTime || '')
            );
          setTasks(rows.map(r => ({ ...r })));
        } else {
          setTasks([]);
        }
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [binding, year]);

  // 获取并赋色图像，然后请求 AI 分析
  const processTask = useCallback(async (task: TaskDisplay) => {
    if (task.colorizedB64 || task.imageLoading || task.imageError) return;

    // 标记加载中
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, imageLoading: true } : t));

    let imageUrl: string | undefined;

    try {
      // 优先使用算法结果图
      if (task.algorithmTaskId) {
        const res = await getAlgorithmImages(task.algorithmTaskId);
        if (res.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
          imageUrl = res.data[0].imageUrl || res.data[0].url || res.data[0].imgUrl;
        }
      }
      // fallback: 无人机原始图（dronePhotoId 暂时没有获取 URL 的确定接口，待对接）
      // if (!imageUrl && task.dronePhotoId) { ... }

      if (!imageUrl) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, imageLoading: false, imageError: true } : t));
        return;
      }

      // 赋色
      const colorRes = await colorizeImage(imageUrl);
      if (!colorRes.ok) throw new Error('colorize failed');

      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, imageUrl, colorizedB64: colorRes.base64, stats: colorRes.stats, imageLoading: false, aiLoading: true }
          : t
      ));

      // AI 分析
      const ctx: AnalyzeContext = {
        landName: task.landName,
        date: task.scheduledStartTime?.slice(0, 10) || '',
        imageType: task.algorithmTaskId ? 'NDVI算法图' : '无人机原始图（第一波段）',
        ndviStats: colorRes.stats,
      };
      const aiRes = await analyzeImage(colorRes.base64, `task-${task.id}`, ctx);

      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, aiText: aiRes.text, aiGrade: aiRes.grade, aiLoading: false }
          : t
      ));
    } catch (e) {
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, imageLoading: false, imageError: true, aiLoading: false } : t
      ));
    }
  }, []);

  // 可见任务进入视图时自动处理
  const visibleTasks = expanded ? tasks : tasks.slice(0, PREVIEW_COUNT);
  useEffect(() => {
    visibleTasks.forEach(t => processTask(t));
  }, [visibleTasks.length, expanded]);

  return (
    <section className="px-4 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
          <Sprout size={18} className="text-emerald-500" />
          农情监测
        </h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-100 rounded-3xl animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-zinc-400 text-sm bg-zinc-50 rounded-3xl border border-zinc-100">
          {year}年暂无无人机监测任务
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleTasks.map(task => {
              const grade = task.aiGrade || '—';
              const gStyle = GRADE_STYLE[grade] || GRADE_STYLE['—'];
              return (
                <div key={task.id} className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden flex">
                  {/* 左侧：赋色缩略图 */}
                  <div className="w-24 h-24 bg-zinc-100 flex-shrink-0 flex items-center justify-center relative">
                    {task.colorizedB64 ? (
                      <>
                        <img
                          src={task.colorizedB64}
                          alt="农情监测"
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setLightbox(task.colorizedB64!)}
                        />
                        <button
                          onClick={() => setLightbox(task.colorizedB64!)}
                          className="absolute bottom-1 right-1 bg-black/40 rounded-full p-0.5"
                        >
                          <ZoomIn size={12} className="text-white" />
                        </button>
                      </>
                    ) : task.imageLoading ? (
                      <Loader2 size={20} className="text-zinc-400 animate-spin" />
                    ) : (
                      <ImageOff size={20} className="text-zinc-300" />
                    )}
                  </div>

                  {/* 右侧：分析结果 */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-400">{task.scheduledStartTime?.slice(0, 10)}</p>
                        <p className="text-sm font-semibold text-zinc-700 mt-0.5 truncate">
                          {task.landName || task.taskName}
                        </p>
                      </div>
                      <div className={`text-2xl font-bold shrink-0 ${gStyle.big}`}>{grade}</div>
                    </div>

                    <div className="mt-1">
                      {task.aiLoading ? (
                        <div className="flex items-center gap-1 text-xs text-zinc-400">
                          <Loader2 size={10} className="animate-spin" /> AI分析中…
                        </div>
                      ) : task.aiText ? (
                        <p className={`text-xs leading-relaxed ${gStyle.text}`}>{task.aiText}</p>
                      ) : task.imageError ? (
                        <p className="text-xs text-zinc-300">暂无图像数据</p>
                      ) : (
                        <p className="text-xs text-zinc-300">等待图像加载…</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {tasks.length > PREVIEW_COUNT && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full mt-3 py-2.5 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-2xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              {expanded ? '收起' : `展开全部 ${tasks.length} 条记录`}
            </button>
          )}
        </>
      )}

      {/* 大图 Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          <img
            src={lightbox}
            alt="农情监测大图"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};
