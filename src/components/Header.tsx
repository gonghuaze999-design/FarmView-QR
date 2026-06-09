import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, QrCode, ChevronRight, Download } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';
import { useSiteContext } from '../contexts/SiteContext';

// 二维码生成弹窗
const QRModal: React.FC<{ url: string; siteName: string; onClose: () => void }> = ({ url, siteName, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    import('qrcode').then(QRCode => {
      if (!canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }, (err) => {
        if (!err) {
          setQrReady(true);
          setQrDataUrl(canvasRef.current!.toDataURL('image/png'));
        }
      });
    });
  }, [url]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${siteName}-二维码.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl p-6 mx-4 w-full max-w-xs sm:max-w-sm md:max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-zinc-800">基地推广码</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 二维码卡片 */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100 flex flex-col items-center">
          {/* 装饰性农业图标 */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-lg">🌾</span>
            <span className="text-sm font-bold text-emerald-700">{siteName}</span>
            <span className="text-lg">🌾</span>
          </div>

          {/* 二维码 - 显示为图片方便长按保存 */}
          <div className="relative bg-white rounded-2xl p-3 shadow-sm border border-emerald-100">
            <canvas ref={canvasRef} className={qrReady ? 'hidden' : 'block'} />
            {qrReady && qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="二维码"
                className="block w-60 h-60"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            {/* 中心 logo 装饰 */}
            {qrReady && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white rounded-lg p-1 shadow-sm border border-emerald-100">
                  <span className="text-lg">🌿</span>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-emerald-600/70 mt-3 text-center">扫码访问基地实时监控</p>
          <p className="text-[10px] text-zinc-400 mt-1 text-center">微信内可长按图片保存到相册</p>
        </div>

        {/* 保存按钮 - 兼容 iOS Safari / Android Chrome / 微信 */}
        <button
          onClick={() => {
            if (!qrDataUrl) return;
            // 创建临时 a 标签触发下载
            const a = document.createElement('a');
            a.href = qrDataUrl;
            a.download = `${siteName}-二维码.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          disabled={!qrDataUrl}
          className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
        >
          <Download size={16} />
          保存到本地
        </button>
      </div>
    </div>
  );
};

export const Header: React.FC = () => {
  const { binding } = useSiteContext();
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState<any[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';
    try {
      const r = await fetch(`/api/ai/notifications?site=${siteKey}`);
      const d = await r.json();
      setUnreadNotifs(d.unread || []);
    } catch {}
  };

  useEffect(() => { fetchNotifications(); const t = setInterval(fetchNotifications, 5 * 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!showBellMenu) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBellMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBellMenu]);

  const displayName = binding?.siteName || '农场主';

  // 当前页面 URL（用于生成二维码）
  const currentUrl = window.location.href;

  return (
    <>
      <header className="bg-white/90 backdrop-blur-xl px-4 py-3 flex items-center justify-between fixed top-0 left-1/2 -translate-x-1/2 z-50 border-b shadow-sm w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl" style={{ borderColor: '#f0f0eb' }}>
        {/* 左侧：基地名称 */}
        <h1 className="text-base font-bold text-zinc-800 truncate max-w-[200px] sm:max-w-[300px] flex-shrink">{displayName}</h1>

        {/* 右侧：气象 + 铃铛 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <WeatherWidget />

          <div className="relative" ref={bellRef}>
            <button
              onClick={() => { setShowBellMenu(!showBellMenu); if (!showBellMenu) fetchNotifications(); }}
              className="relative p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <Bell size={20} />
              {unreadNotifs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                  {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                </span>
              )}
            </button>

            {showBellMenu && (
              <div className="absolute right-0 top-11 w-72 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-[60]">
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-800">
                    {unreadNotifs.length > 0 ? `紧急通知 (${unreadNotifs.length})` : '消息中心'}
                  </span>
                  {unreadNotifs.length > 0 && (
                    <button onClick={async () => {
                      const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';
                      await fetch('/api/ai/notifications/read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({site:siteKey}) });
                      setUnreadNotifs([]);
                    }} className="text-[10px] text-zinc-400 hover:text-zinc-600">全部已读</button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {unreadNotifs.length > 0 ? unreadNotifs.map((n: any, i: number) => (
                    <div key={i} className="px-4 py-2.5 border-b border-zinc-50 hover:bg-zinc-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{n.category}</span>
                        <span className="text-[10px] text-zinc-400">{n.time ? new Date(n.time).toLocaleString('zh-CN') : ''}</span>
                      </div>
                      <p className="text-xs text-zinc-700 leading-relaxed">{n.detail}</p>
                    </div>
                  )) : (
                    <div className="px-4 py-6 text-center text-xs text-zinc-400">暂无紧急通知</div>
                  )}
                </div>
                <button onClick={() => { setShowBellMenu(false); setShowQR(true); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-500 hover:bg-zinc-50 border-t border-zinc-100">
                  <span className="flex items-center gap-1.5"><QrCode size={12} />基地推广</span>
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showQR && (
        <QRModal
          url={currentUrl}
          siteName={displayName}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
};
