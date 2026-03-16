import React, { useState, useRef } from 'react';
import { Maximize2, Minimize2, Map as MapIcon, Leaf } from 'lucide-react';
import { MapComponent } from './MapComponent';

export const MapSection: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const mapRef = useRef<any>(null);

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
    <section className={`farm-card relative ${isFullScreen ? 'fixed inset-0 z-[100] rounded-none' : 'h-[400px]'}`}>
      <div className="absolute inset-0 z-0">
        <MapComponent isFullScreen={isFullScreen} ref={mapRef} />
      </div>
      
      {/* 顶部控制栏 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/50 flex items-center gap-2 pointer-events-auto">
          <MapIcon size={16} className="text-emerald-600" />
          <span className="text-sm font-bold text-zinc-800">基地地图</span>
        </div>
        
        <button 
          onClick={toggleFullScreen}
          className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-sm border border-white/50 text-zinc-600 hover:text-emerald-600 hover:bg-white transition-colors pointer-events-auto"
        >
          {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* 底部信息卡片 */}
      <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/50 pointer-events-auto max-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <h3 className="font-bold text-zinc-800 text-sm">A区 种植地</h3>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">面积</span>
              <span className="font-medium text-zinc-700">10.5 亩</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">作物</span>
              <span className="font-medium text-emerald-600 flex items-center gap-1">
                <Leaf size={10} />
                玉米
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
