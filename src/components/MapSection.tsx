import React, { useState, useRef } from 'react';
import { Maximize2, Minimize2, Map as MapIcon, Leaf, X, Info, Video, Thermometer, Droplets, Activity, Play, Bug } from 'lucide-react';
import { MapComponent, DeviceMarker } from './MapComponent';
import { useSiteContext } from '../contexts/SiteContext';

export const MapSection: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isDeviceSheetOpen, setIsDeviceSheetOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceMarker | null>(null);
  const mapRef = useRef<any>(null);
  const { binding } = useSiteContext();

  const center: [number, number] = (binding?.center && !isNaN(binding.center[0]) && !isNaN(binding.center[1])) 
    ? binding.center 
    : [116.397428, 39.90923];

  const mockDevices: DeviceMarker[] = [
    { id: 'w1', type: 'weather', name: '1号气象站', position: [center[0] - 0.001, center[1] + 0.001], status: 'online' },
    { id: 'i1', type: 'insect', name: '1号虫情测报站', position: [center[0] + 0.001, center[1] - 0.0005], status: 'online' },
    { id: 'c1', type: 'camera', name: '主监控摄像头', position: [center[0] + 0.0015, center[1] + 0.001], status: 'online' },
  ];

  const handlePolygonClick = () => {
    setIsBottomSheetOpen(true);
    setIsDeviceSheetOpen(false);
  };

  const handleDeviceClick = (device: DeviceMarker) => {
    setSelectedDevice(device);
    setIsDeviceSheetOpen(true);
    setIsBottomSheetOpen(false);
  };

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
          center={center}
          polygon={binding?.polygon || [
            [116.396, 39.908],
            [116.399, 39.908],
            [116.399, 39.910],
            [116.396, 39.910]
          ]}
          devices={mockDevices}
          onPolygonClick={handlePolygonClick}
          onDeviceClick={handleDeviceClick}
        />
      </div>
      
      {/* 顶部控制栏 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/50 flex items-center gap-2 pointer-events-auto">
          <MapIcon size={16} className="text-emerald-600" />
          <span className="text-sm font-bold text-zinc-800">{binding?.siteName || 'A区 种植地'}</span>
        </div>
        
        <button 
          onClick={toggleFullScreen}
          className="bg-white/90 backdrop-blur-md p-2.5 rounded-full shadow-sm border border-white/50 text-zinc-600 hover:text-emerald-600 hover:bg-white transition-colors pointer-events-auto"
        >
          {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* 底部提示 (当 Bottom Sheet 未打开时显示) */}
      {!isBottomSheetOpen && !isDeviceSheetOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none flex justify-center">
          <div className="bg-zinc-900/70 backdrop-blur-md px-4 py-2 rounded-full shadow-lg pointer-events-auto animate-bounce">
            <span className="text-xs font-medium text-white flex items-center gap-1">
              <Info size={14} /> 点击地图上的高亮区域或设备查看详情
            </span>
          </div>
        </div>
      )}

      {/* Bottom Sheet 遮罩层 (全屏) */}
      <div 
        className={`fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isBottomSheetOpen || isDeviceSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          setIsBottomSheetOpen(false);
          setIsDeviceSheetOpen(false);
        }}
      />

      {/* Bottom Sheet 农田信息面板 (固定在屏幕底部) */}
      <div 
        className={`fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md z-[101] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
          isBottomSheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <h3 className="font-bold text-zinc-800 text-lg">{binding?.siteName || 'A区 种植地'}</h3>
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

      {/* 设备信息 Bottom Sheet */}
      <div 
        className={`fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md z-[101] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
          isDeviceSheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${selectedDevice?.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
              <h3 className="font-bold text-zinc-800 text-lg">{selectedDevice?.name || '设备详情'}</h3>
            </div>
            <button 
              onClick={() => setIsDeviceSheetOpen(false)}
              className="p-1.5 bg-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {selectedDevice?.type === 'camera' ? (
            <div className="space-y-4">
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center group cursor-pointer">
                <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                </div>
                <video 
                  src="https://www.w3schools.com/html/mov_bbb.mp4"
                  autoPlay 
                  muted 
                  playsInline 
                  loop 
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform z-10">
                  <Play className="text-white ml-1" size={24} />
                </div>
              </div>
              <div className="flex justify-between text-sm text-zinc-500 px-1">
                <span>分辨率: 1080P</span>
                <span>网络延迟: 45ms</span>
              </div>
            </div>
          ) : selectedDevice?.type === 'insect' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 flex flex-col items-center justify-center text-center">
                <Bug className="text-violet-500 mb-2" size={24} />
                <span className="text-xs text-violet-600/70 mb-1">今日诱虫</span>
                <span className="font-bold text-violet-700 text-xl">128<span className="text-sm font-normal ml-0.5">只</span></span>
              </div>
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-zinc-500 mb-1">主要害虫</span>
                <span className="font-bold text-zinc-700 text-lg">草地贪夜蛾</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center">
                <Thermometer className="text-blue-500 mb-2" size={24} />
                <span className="text-xs text-blue-600/70 mb-1">当前温度</span>
                <span className="font-bold text-blue-700 text-xl">24.5<span className="text-sm font-normal ml-0.5">°C</span></span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                <Droplets className="text-emerald-500 mb-2" size={24} />
                <span className="text-xs text-emerald-600/70 mb-1">环境湿度</span>
                <span className="font-bold text-emerald-700 text-xl">62<span className="text-sm font-normal ml-0.5">%</span></span>
              </div>
              {selectedDevice?.type === 'weather' && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center justify-center text-center col-span-2">
                  <Activity className="text-amber-500 mb-2" size={24} />
                  <span className="text-xs text-amber-600/70 mb-1">光照强度</span>
                  <span className="font-bold text-amber-700 text-xl">45000<span className="text-sm font-normal ml-0.5">Lux</span></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
