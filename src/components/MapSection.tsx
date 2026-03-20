import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, Map as MapIcon, Leaf, X, Info, Thermometer, Droplets, Activity, Bug, Cloud } from 'lucide-react';
import { MapComponent, DeviceMarker } from './MapComponent';
import { useSiteContext } from '../contexts/SiteContext';
import { getFarmlandList, getIotLocations, getEnvDataNow, getInsectData, getCameraList } from '../services/api';

// HLS 视频播放器（支持萤石云 HLS 流）
const HlsPlayer: React.FC<{ src: string }> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!src || !videoRef.current) return;
    const video = videoRef.current;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
          return () => hls.destroy();
        }
      });
    }
  }, [src]);
  return <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />;
};

export const MapSection: React.FC = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isDeviceSheetOpen, setIsDeviceSheetOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceMarker | null>(null);
  const [deviceData, setDeviceData] = useState<any>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState<any>(null);
  const [polygons, setPolygons] = useState<any[]>([]);
  const [devices, setDevices] = useState<DeviceMarker[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([122.063, 46.133]);
  const mapRef = useRef<any>(null);
  const { binding } = useSiteContext();

  useEffect(() => {
    const fetchData = async () => {
      if (!binding) return;
      
      try {
        const baseId = binding.baseId;
        const farmlandIds = binding.farmlandIds || [];
        const { weatherIds = [], insectIds = [], cameraIds = [] } = binding.devices || {};

        const [landRes, iotRes] = await Promise.all([
          getFarmlandList(baseId),
          getIotLocations(baseId)
        ]);

        let parsedPolygons: any[] = [];
        if (landRes.code === 200 && landRes.data) {
          // 解析 WKT 格式的 mapPolygonGeo
          // 强制打印获取到的原始数据
          console.log('[MapSection] 原始地块数据:', landRes.data);
          parsedPolygons = landRes.data.map((land: any) => {
            let coords = [];
            if (land.mapPolygonGeo) {
              try {
                const match = land.mapPolygonGeo.match(/POLYGON\(\((.*?)\)\)/);
                if (match && match[1]) {
                  const points = match[1].split(',');
                  coords = points.map((p: string) => {
                    const [lng, lat] = p.trim().split(' ').map(Number);
                    return [lng, lat];
                  });
                }
              } catch (e) {
                console.error('Failed to parse polygon', e);
              }
            }
            return {
              ...land,
              coordinates: coords
            };
          }).filter((p: any) => p.coordinates.length > 0);
          
          setPolygons(parsedPolygons);

          // 计算中心点（局部变量，立即用于设备坐标偏移）
          let computedCenterLng = 122.063;
          let computedCenterLat = 46.133;
          if (parsedPolygons.length > 0) {
            let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
            parsedPolygons.forEach(p => {
              p.coordinates.forEach((coord: number[]) => {
                if (coord[0] < minLng) minLng = coord[0];
                if (coord[0] > maxLng) maxLng = coord[0];
                if (coord[1] < minLat) minLat = coord[1];
                if (coord[1] > maxLat) maxLat = coord[1];
              });
            });
            computedCenterLng = (minLng + maxLng) / 2;
            computedCenterLat = (minLat + maxLat) / 2;
            setMapCenter([computedCenterLng, computedCenterLat]);
          }

          // 设备打点（在同一作用域内使用刚计算的中心点）
          if (iotRes.code === 200 && iotRes.data) {
            const parsedDevices = iotRes.data.map((iot: any, idx: number) => {
              let position: [number, number] = [0, 0];
              const lng = iot.longitude || iot.longtitude;
              const lat = iot.latitude;
              if (lng && lat) {
                position = [Number(lng), Number(lat)];
              } else if (iot.location) {
                try {
                  const loc = typeof iot.location === 'string' ? JSON.parse(iot.location) : iot.location;
                  const locLng = loc.longitude || loc.longtitude;
                  const locLat = loc.latitude;
                  if (locLng && locLat) {
                    position = [Number(locLng), Number(locLat)];
                  }
                } catch (e) { /* ignore */ }
              }
              if (position[0] === 0) {
                const offset = 0.002;
                position = [computedCenterLng + (idx % 3 - 1) * offset, computedCenterLat + Math.floor(idx / 3) * offset];
              }

              const nameStr = String(iot.name || '').toLowerCase();
              const idStr = String(iot.id);
              let type = 'weather';
              if (nameStr.includes('虫') || insectIds.map(String).includes(idStr)) {
                type = 'insect';
              } else if (nameStr.includes('球机') || nameStr.includes('摄像') || nameStr.includes('监控') || cameraIds.map(String).includes(idStr)) {
                type = 'camera';
              }

              return {
                id: idStr,
                type,
                name: iot.name || `设备 ${iot.id}`,
                position,
                status: iot.is_used === 1 ? 'online' : 'offline'
              };
            }).filter((d: any) => {
              const allIds = [...weatherIds.map(String), ...insectIds.map(String), ...cameraIds.map(String)];
              return allIds.includes(d.id);
            });
            setDevices(parsedDevices);
            console.log('[MapSection] 设备列表:', parsedDevices.length, '个，中心点:', computedCenterLng, computedCenterLat);
          }
        }
      } catch (error) {
        console.error('Failed to fetch map data', error);
      }
    };
    fetchData();
  }, [binding]);

  const handlePolygonClick = (polygonData?: any) => {
    setSelectedPolygon(polygonData);
    setIsBottomSheetOpen(true);
    setIsDeviceSheetOpen(false);
  };

  const handleDeviceClick = async (device: DeviceMarker) => {
    setSelectedDevice(device);
    setIsDeviceSheetOpen(true);
    setIsBottomSheetOpen(false);
    setDeviceLoading(true);
    setDeviceData(null);

    try {
      if (!binding) return;
      const baseId = binding.baseId;
      const farmlandId = binding.farmlandIds?.[0] || '';
      const now = new Date();
      const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const endTime = now.toISOString().replace('T', ' ').substring(0, 19);

      if (device.type === 'weather') {
        // 先试实时接口，null 则用历史数据接口
        const resNow = await getEnvDataNow(farmlandId);
        if (resNow.data) {
          setDeviceData(resNow.data);
        } else {
          const res = await getEnvData(farmlandId, startTime, endTime);
          setDeviceData(res.data);
        }
      } else if (device.type === 'insect') {
        const res = await getInsectData(farmlandId, startTime, endTime);
        setDeviceData(res.data);
      } else if (device.type === 'camera') {
        const res = await getCameraList(baseId, String(farmlandId));
        setDeviceData(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch device data', e);
    } finally {
      setDeviceLoading(false);
    }
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
          center={mapCenter}
          polygon={[]}
          polygons={polygons}
          devices={devices}
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
              <h3 className="font-bold text-zinc-800 text-lg">{selectedPolygon?.farmlandName || binding?.siteName || 'A区 种植地'}</h3>
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
              <span className="font-bold text-zinc-800">{selectedPolygon?.size || '10.5'} <span className="text-xs font-normal text-zinc-500">亩</span></span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
              <span className="text-xs text-emerald-600/70 block mb-1">当前状态</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <Leaf size={14} /> {selectedPolygon?.status === 1 ? '种植中' : '空闲中'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
              <span className="text-zinc-500">土地用途</span>
              <span className="font-medium text-zinc-700">{selectedPolygon?.mapType || '基本农田'}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
              <span className="text-zinc-500">备注</span>
              <span className="font-medium text-zinc-700">{selectedPolygon?.remark || '无'}</span>
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

          {deviceLoading ? (
            <div className="text-center py-8 text-zinc-400 text-sm">加载设备数据中...</div>
          ) : selectedDevice?.type === 'camera' ? (
            <div className="space-y-3">
              {deviceData && deviceData.length > 0 ? deviceData.map((cam: any, idx: number) => (
                <div key={idx} className="rounded-2xl overflow-hidden bg-black">
                  <div className="relative aspect-video flex items-center justify-center">
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                    </div>
                    <HlsPlayer src={cam.hls || cam.videoUrl} />
                  </div>
                  <div className="px-3 py-2 bg-zinc-900">
                    <p className="text-xs text-zinc-300 font-medium">{cam.cameraName || cam.name || `摄像头 ${idx + 1}`}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{cam.status === 1 ? '🟢 在线' : '🔴 离线'}</p>
                  </div>
                </div>
              )) : (
                <div className="text-zinc-500 text-sm text-center py-8">暂无视频流</div>
              )}
            </div>
          ) : selectedDevice?.type === 'insect' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 flex flex-col items-center justify-center text-center">
                  <Bug className="text-violet-500 mb-2" size={24} />
                  <span className="text-xs text-violet-600/70 mb-1">累计诱虫</span>
                  <span className="font-bold text-violet-700 text-xl">
                    {deviceData?.total ?? '--'}
                    <span className="text-sm font-normal ml-0.5">只</span>
                  </span>
                </div>
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-zinc-500 mb-1">主要害虫</span>
                  <span className="font-bold text-zinc-700 text-sm">
                    {deviceData?.insect?.[0]?.insectName || '暂无数据'}
                  </span>
                </div>
              </div>
              {deviceData?.insect?.length > 0 && (
                <div className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden">
                  {deviceData.insect.slice(0, 5).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-2.5 border-b border-zinc-100 last:border-0">
                      <span className="text-sm text-zinc-700">{item.insectName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-violet-700">{item.insectValue}</span>
                        <span className="text-xs text-zinc-400">{item.percent}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center">
                <Thermometer className="text-blue-500 mb-2" size={24} />
                <span className="text-xs text-blue-600/70 mb-1">空气温度</span>
                <span className="font-bold text-blue-700 text-xl">
                  {deviceData?.airTemperature ?? deviceData?.air_temperature ?? '--'}
                  <span className="text-sm font-normal ml-0.5">°C</span>
                </span>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                <Droplets className="text-emerald-500 mb-2" size={24} />
                <span className="text-xs text-emerald-600/70 mb-1">空气湿度</span>
                <span className="font-bold text-emerald-700 text-xl">
                  {deviceData?.airHumidity ?? deviceData?.air_humidity ?? '--'}
                  <span className="text-sm font-normal ml-0.5">%</span>
                </span>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center justify-center text-center">
                <Activity className="text-amber-500 mb-2" size={24} />
                <span className="text-xs text-amber-600/70 mb-1">风速</span>
                <span className="font-bold text-amber-700 text-xl">
                  {deviceData?.windSpeed ?? deviceData?.wind_speed ?? '--'}
                  <span className="text-sm font-normal ml-0.5">m/s</span>
                </span>
              </div>
              <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 flex flex-col items-center justify-center text-center">
                <Cloud className="text-sky-500 mb-2" size={24} />
                <span className="text-xs text-sky-600/70 mb-1">降水量</span>
                <span className="font-bold text-sky-700 text-xl">
                  {deviceData?.precipitation ?? '--'}
                  <span className="text-sm font-normal ml-0.5">mm</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
