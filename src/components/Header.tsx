import React, { useState, useRef, useEffect } from 'react';
import { Bell, Edit2, X, Camera, Check, QrCode, ChevronRight, Download } from 'lucide-react';
import { WeatherWidget } from './WeatherWidget';
import { useSiteContext } from '../contexts/SiteContext';

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/thumbs/svg?seed=farm1&backgroundColor=d1fae5',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=farm2&backgroundColor=dbeafe',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=farm3&backgroundColor=fef3c7',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=farm4&backgroundColor=fce7f3',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=farm5&backgroundColor=ede9fe',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=farm6&backgroundColor=d1fae5',
];

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
      <div className="bg-white rounded-3xl shadow-2xl p-6 mx-4 w-full max-w-xs" onClick={e => e.stopPropagation()}>
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
          <p className="text-[10px] text-zinc-400 mt-1 text-center">长按图片可保存到相册</p>
        </div>

        {/* 下载按钮（桌面端备用） */}
        <a
          href={qrDataUrl}
          download={`${siteName}-二维码.png`}
          className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors"
        >
          <Download size={16} />
          下载二维码
        </a>
      </div>
    </div>
  );
};

// 头像选择弹窗
const AvatarModal: React.FC<{
  current: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}> = ({ current, onSelect, onClose }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onSelect(ev.target.result as string);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-md p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-zinc-800">选择头像</h3>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 默认头像网格 */}
        <div className="grid grid-cols-6 gap-2 mb-4">
          {DEFAULT_AVATARS.map((url, i) => (
            <button
              key={i}
              onClick={() => { onSelect(url); onClose(); }}
              className={`relative w-full aspect-square rounded-full overflow-hidden border-2 transition-all ${current === url ? 'border-emerald-500 scale-110' : 'border-transparent hover:border-emerald-300'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {current === url && (
                <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                  <Check size={12} className="text-emerald-600" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* 上传自定义头像 */}
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-zinc-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
        >
          <Camera size={16} />
          上传自定义头像
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
};

export const Header: React.FC = () => {
  const { binding } = useSiteContext();
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('farmview_avatar') || DEFAULT_AVATARS[0]);
  const [userName, setUserName] = useState(() => localStorage.getItem('farmview_username') || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 默认名称用基地名
  const displayName = userName || binding?.siteName || '农场主';

  // 当前页面 URL（用于生成二维码）
  const currentUrl = window.location.href;

  const handleNameSave = () => {
    localStorage.setItem('farmview_username', userName);
    setIsEditingName(false);
  };

  const handleAvatarSelect = (url: string) => {
    setAvatarUrl(url);
    localStorage.setItem('farmview_avatar', url);
  };

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.focus();
  }, [isEditingName]);

  return (
    <>
      <header className="bg-white/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-zinc-100 shadow-sm">
        {/* 左侧：头像 + 名称 */}
        <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
          <button
            onClick={() => setShowAvatarModal(true)}
            className="relative w-10 h-10 flex-shrink-0 group"
          >
            <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full border-2 border-white shadow-sm object-cover transition-transform group-hover:scale-105" />
            <div className="absolute -bottom-0.5 -right-0.5 bg-white p-0.5 rounded-full shadow-sm border border-zinc-100 text-zinc-400 group-hover:text-emerald-600 transition-colors">
              <Edit2 size={10} />
            </div>
          </button>

          {isEditingName ? (
            <div className="flex items-center gap-1">
              <input
                ref={nameInputRef}
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                placeholder={binding?.siteName || '输入名称'}
                className="text-base font-bold text-zinc-800 outline-none border-b-2 border-emerald-500 bg-transparent w-28 placeholder-zinc-300"
              />
              <button onClick={handleNameSave} className="p-1 text-emerald-500 hover:text-emerald-600">
                <Check size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-base font-bold text-zinc-800 truncate max-w-[120px] hover:text-emerald-600 transition-colors text-left"
            >
              {displayName}
            </button>
          )}
        </div>

        {/* 右侧：气象 + 铃铛 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <WeatherWidget />

          <div className="relative">
            <button
              onClick={() => setShowBellMenu(!showBellMenu)}
              className="relative p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            </button>

            {showBellMenu && (
              <>
                <div className="fixed inset-0 z-[59]" onClick={() => setShowBellMenu(false)} />
                <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-[60]">
                  <button
                    onClick={() => { setShowBellMenu(false); setShowQR(true); }}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <QrCode size={16} className="text-emerald-500" />
                      基地推广
                    </div>
                    <ChevronRight size={14} className="text-zinc-400" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showAvatarModal && (
        <AvatarModal
          current={avatarUrl}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

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
