import React, { useState, useRef } from 'react';
import { Maximize2, Minimize2, Map as MapIcon, Leaf, X, Info } from 'lucide-react';
import { MapComponent } from './MapComponent';
import { useSiteContext } from '../contexts/SiteContext';

export const MapSection: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const mapRef = useRef<any>(null);
  const { binding } = useSiteContext();

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    // 稍微延迟以等待布局变化
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    }, 100);
  };

  return (
    <section className={`farm-card relative overflow-hidden ${isFullScreen ? 'fixed inset-0 z-[100] rounded-none' : 'h-[400px]'}`}>
      <div className="absolute inset-0 z-0">
        <MapComponent 
          isFullScreen={isFullScreen} 
          ref={mapRef} 
          center={binding?.center}
          polygon={binding?.polygon}
          onPolygonClick={() => setIsBottomSheetOpen(true)}
        />
      </div>
      
      {/* 顶部控制栏 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/50 flex items-center gap-2 pointer-events-auto">
          <MapIcon size={16} className="text-emerald-600" />
          <span className="text-sm font-bold text-zinc-800">{binding?.siteName || '基地地图'}</span>
        </div>
        
        <button 
          onClick={toggleFullScreen}
          className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-sm border border-white/50 text-zinc-600 hover:text-emerald-600 hover:bg-white transition-colors pointer-events-auto"
        >
          {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* 底部提示 (当 Bottom Sheet 未打开时显示) */}
      {!isBottomSheetOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none flex justify-center">
          <div className="bg-zinc-900/70 backdrop-blur-md px-4 py-2 rounded-full shadow-lg pointer-events-auto animate-bounce">
            <span className="text-xs font-medium text-white flex items-center gap-1">
              <Info size={14} /> 点击地图上的高亮区域查看详情
            </span>
          </div>
        </div>
      )}

      {/* Bottom Sheet 农田信息面板 */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
          isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <h3 className="font-bold text-zinc-800 text-lg">{binding?.siteName || '目标地块'}</h3>
            </div>
            <button 
              onClick={() => setIsBottomSheetOpen(false)}
              className="p-1.5 bg-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
              <span className="text-xs text-zinc-500 block mb-1">地块面积</span>
              <span className="font-bold text-zinc-800">10.5 <span className="text-xs font-normal text-zinc-500">亩</span></span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
              <span className="text-xs text-emerald-600/70 block mb-1">当前作物</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <Leaf size={14} /> 玉米
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
              <span className="text-zinc-500">土地用途</span>
              <span className="font-medium text-zinc-700">基本农田</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
              <span className="text-zinc-500">负责人</span>
              <span className="font-medium text-zinc-700">张三</span>
            </div>
            <div className="flex justify-between text-sm py-2">
              <span className="text-zinc-500">最近农事</span>
              <span className="font-medium text-zinc-700">施肥 (2天前)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
