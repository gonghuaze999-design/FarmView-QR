import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Wifi, WifiOff, Maximize2, Minimize2, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { getCameraList } from '../services/api';
import Hls from 'hls.js';

interface CameraInfo {
  id: string;
  cameraName: string;
  hls?: string;
  videoUrl?: string;
  status: number; // 1=在线
  deviceName?: string;
  location?: string;
}

interface CameraTabProps {
  onFullscreenChange?: (fs: boolean) => void;
}

const HlsPlayer: React.FC<{ src: string; fallbackSrc?: string; cameraName?: string; onPlayStatus?: (s: 'loading' | 'playing' | 'error') => void }> = ({ src, fallbackSrc, cameraName, onPlayStatus }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryRef = useRef(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');

  useEffect(() => { onPlayStatus?.(status); }, [status, onPlayStatus]);

  const doPlay = useCallback((video: HTMLVideoElement | null, streamUrl: string) => {
    if (!video || !streamUrl) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setStatus('loading');

    const onPlaying = () => { setStatus('playing'); };
    const onError = () => { setStatus('error'); };
    video.addEventListener('playing', onPlaying, { once: true });
    video.addEventListener('error', onError, { once: true });

    const tryNative = () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(() => setStatus('error'));
        return true;
      }
      return false;
    };

    if (tryNative()) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setStatus('error'));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setStatus('error');
          if (retryRef.current < 1) {
            retryRef.current++;
            setTimeout(() => doPlay(video, streamUrl), 3000);
          }
        }
      });
    } else {
      video.src = streamUrl;
    }
  }, []);

  // 主播放器
  useEffect(() => {
    retryRef.current = 0;
    doPlay(videoRef.current, src);
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src, doPlay]);

  // 全屏播放器
  useEffect(() => {
    if (fullscreen) {
      retryRef.current = 0;
      doPlay(fullVideoRef.current, fallbackSrc || src);
    }
    return () => { if (fullscreen && hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [fullscreen, src, fallbackSrc, doPlay]);

  return (
    <>
      <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
        {/* Native Safari: video element hidden until src set; others: hls.js controlled */}
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

        {/* Loading */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 size={28} className="text-white/70 animate-spin" />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 gap-2">
            <AlertTriangle size={24} className="text-amber-400" />
            <span className="text-white/60 text-xs">视频流加载失败</span>
            <button
              onClick={() => doPlay(videoRef.current, src)}
              className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
            >
              点击重试
            </button>
          </div>
        )}

        {/* 名称 + LIVE */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <span className="text-white text-sm font-medium bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
            {cameraName || '摄像头'}
          </span>
          <span className="flex items-center gap-1 bg-red-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
          </span>
        </div>
        {/* 全屏按钮 */}
        <button
          onClick={() => setFullscreen(true)}
          className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/60 transition-colors"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
          <video ref={fullVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 size={36} className="text-white/50 animate-spin" />
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={32} className="text-amber-400" />
              <span className="text-white/60 text-sm">视频流加载失败</span>
              <button
                onClick={() => doPlay(fullVideoRef.current, fallbackSrc || src)}
                className="text-sm text-white bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors"
              >
                重试
              </button>
            </div>
          )}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full">{cameraName || 'LIVE'}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-white text-xs bg-red-500/80 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
              </span>
              <button onClick={() => setFullscreen(false)} className="bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-colors">
                <Minimize2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const CameraTab: React.FC<CameraTabProps> = () => {
  const { binding } = useSiteContext();
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playStatus, setPlayStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlayStatus('loading');
    const timeout = setTimeout(() => {
      setPlayStatus(prev => prev === 'loading' ? 'error' : prev);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [activeIndex]);

  useEffect(() => {
    if (!binding) return;
    setLoading(true);
    const farmlandIds = (binding.farmlandIds || []).join(',');
    getCameraList(binding.baseId, farmlandIds)
      .then(res => {
        if (res.code === 200 && Array.isArray(res.data)) {
          setCameras(res.data);
        }
      })
      .catch(() => setCameras([]))
      .finally(() => setLoading(false));
  }, [binding]);

  const activeCam = cameras[activeIndex];
  const scrollTo = (index: number) => {
    setActiveIndex(index);
    scrollRef.current?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="aspect-video bg-zinc-100 rounded-2xl animate-pulse" />
        <div className="flex gap-3">
          {[1,2,3].map(i => <div key={i} className="w-24 h-16 bg-zinc-100 rounded-xl animate-pulse flex-shrink-0" />)}
        </div>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="p-5 pt-20 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl" style={{ background: '#fff1f2' }}>📷</div>
        <h3 className="text-base font-bold text-zinc-700 mb-1">暂无摄像头</h3>
        <p className="text-sm text-zinc-400">该基地尚未配置摄像头设备</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 主播放区 */}
      <div className="px-4">
        <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-lg relative">
          {activeCam && activeCam.status === 1 && (activeCam.hls || activeCam.videoUrl) ? (
            <HlsPlayer
              src={activeCam.hls || ''}
              fallbackSrc={activeCam.videoUrl || ''}
              cameraName={activeCam.cameraName}
              onPlayStatus={setPlayStatus}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-900">
              <WifiOff size={32} className="mb-2 text-zinc-600" />
              <span className="text-sm text-zinc-400">{activeCam?.cameraName || '摄像头'}</span>
              <span className="text-xs text-zinc-600 mt-1">设备离线</span>
            </div>
          )}
        </div>

        {/* 设备信息条 */}
        {activeCam && (
          <div className="flex items-center gap-4 mt-2.5 px-1">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${playStatus === 'playing' ? 'bg-emerald-500' : playStatus === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs font-medium text-zinc-600">
                {playStatus === 'playing' ? '在线' : playStatus === 'loading' ? '加载中' : '离线'}
              </span>
            </div>
            <span className="text-xs text-zinc-400 truncate flex-1">{activeCam.cameraName}</span>
            <span className="text-xs text-zinc-400">{cameras.length} 个设备</span>
          </div>
        )}
      </div>

      {/* 摄像头缩略图列表 */}
      <div className="mt-3 px-4">
        <div className="text-xs font-medium text-zinc-500 mb-2">全部摄像头</div>
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {cameras.map((cam, i) => {
            const isActive = i === activeIndex;
            const activeColor = playStatus === 'playing' ? '#10b981' : playStatus === 'loading' ? '#f59e0b' : '#f43f5e';
            return (
              <button
                key={cam.id || i}
                onClick={() => scrollTo(i)}
                className="flex-shrink-0 w-[104px] text-left group"
              >
                {/* 缩略图 — 用统一的暗色背景，不区分在线离线 */}
                <div
                  className={`w-full aspect-video rounded-xl overflow-hidden mb-1.5 relative transition-all ${
                    isActive ? 'ring-2 ring-offset-1 shadow-md' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ ringColor: isActive ? activeColor : 'transparent', background: '#1a1a1a' }}
                >
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <Camera size={18} className="text-zinc-500" />
                  </div>
                  {/* 选中指示条 */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: activeColor }} />
                  )}
                </div>
                {/* 名称 */}
                <span className={`text-[11px] leading-tight block truncate ${isActive ? 'font-semibold text-zinc-800' : 'text-zinc-500'}`}>
                  {cam.cameraName || `摄像头 ${i + 1}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 快捷操作提示 */}
      <div className="mt-3 px-4">
        <div className="rounded-xl px-3 py-2.5 flex items-center gap-3 text-xs" style={{ background: '#fff1f2' }}>
          <div className="flex items-center gap-1.5">
            <Maximize2 size={13} className="text-red-400" />
            <span className="text-zinc-500">点击画面全屏</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ChevronLeft size={13} className="text-red-400" />
            <ChevronRight size={13} className="text-red-400" />
            <span className="text-zinc-500">滑动切换摄像头</span>
          </div>
        </div>
      </div>
    </div>
  );
};
