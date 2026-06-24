import React from 'react';
import { Map, Camera, Sprout, BarChart3 } from 'lucide-react';

export type TabKey = 'overview' | 'camera' | 'agri' | 'data';

interface TabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const tabs: { key: TabKey; label: string; Icon: React.ElementType; color: string; activeBg: string }[] = [
  { key: 'overview', label: '总览',   Icon: Map,       color: '#10b981', activeBg: '#ecfdf5' },
  { key: 'camera',   label: '监控',   Icon: Camera,    color: '#f43f5e', activeBg: '#fff1f2' },
  { key: 'agri',     label: '农情',   Icon: Sprout,    color: '#8b5cf6', activeBg: '#f5f3ff' },
  { key: 'data',     label: '数据',   Icon: BarChart3, color: '#0ea5e9', activeBg: '#f0f9ff' },
];

export const TabBar: React.FC<TabBarProps> = ({ active, onChange }) => {
  const handleClick = (key: TabKey) => {
    // 预激活视频播放权限（浏览器要求play()在用户手势链中触发）
    const v = document.createElement('video'); v.muted = true; v.playsInline = true;
    v.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:0;left:0;width:1px;height:1px';
    document.body.appendChild(v);
    v.play().then(() => v.remove(), () => v.remove());
    onChange(key);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center" style={{ background: '#fffdf7', borderTop: '1px solid #f0f0eb' }}>
      <div className="w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl flex justify-around items-end px-2 pb-1 pt-3">
        {tabs.map(({ key, label, Icon, color, activeBg }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-2xl transition-all duration-200 min-w-[64px]"
              style={{
                background: isActive ? activeBg : 'transparent',
                color: isActive ? color : '#94a3b8',
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[11px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
