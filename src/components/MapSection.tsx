import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, Map as MapIcon, Leaf, X, Info, Thermometer, Droplets, Activity, Bug, Cloud } from 'lucide-react';
import { MapComponent, DeviceMarker } from './MapComponent';
import { useSiteContext } from '../contexts/SiteContext';
import { getFarmlandList, getIotLocations, getEnvLatest, getInsectData, getCameraList, getLandBatchInfo } from '../services/api';
import { wgs84ToGcj02 } from '../utils/coordTransform';

// HLS 视频播放器（支持萤石云 HLS 流）
const HlsPlayer: React.FC<{ src: string; cameraName?: string }> = ({ src, cameraName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const setupHls = (video: HTMLVideoElement) => {
    if (!src || !video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
        }
      });
    }
  };

  useEffect(() => { if (videoRef.current) setupHls(videoRef.current); }, [src]);
  useEffect(() => { if (fullscreen && fullVideoRef.current) setupHls(fullVideoRef.current); }, [fullscreen]);

  return (
    <>
      <div className="relative w-full h-full">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        <button
          onClick={() => setFullscreen(true)}
          className="absolute bottom-3 right-3 bg-black/50 text-white p-1.5 rounded-lg hover:bg-black/80 transition-colors z-10"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
          <video ref={fullVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
              {cameraName || 'LIVE'}
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-white text-xs bg-red-500/80 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
              </span>
              <button
                onClick={() => setFullscreen(false)}
                className="bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
              >
                <Minimize2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
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
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>();
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
                    return wgs84ToGcj02(lng, lat);
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
          let computedCenterLng = 116.397;
          let computedCenterLat = 39.909;
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
                position = wgs84ToGcj02(Number(lng), Number(lat));
              } else if (iot.location) {
                try {
                  const loc = typeof iot.location === 'string' ? JSON.parse(iot.location) : iot.location;
                  const locLng = loc.longitude || loc.longtitude;
                  const locLat = loc.latitude;
                  if (locLng && locLat) {
                    position = wgs84ToGcj02(Number(locLng), Number(locLat));
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

  const [polygonBatch, setPolygonBatch] = useState<any>(null);
  const [polygonBatchLoading, setPolygonBatchLoading] = useState(false);

  const handlePolygonClick = async (polygonData?: any) => {
    setSelectedPolygon(polygonData);
    setIsBottomSheetOpen(true);
    setIsDeviceSheetOpen(false);
    setPolygonBatch(null);
    if (polygonData?.id) {
      setPolygonBatchLoading(true);
      try {
        const res = await getLandBatchInfo(polygonData.id);
        if (res.code === 200 && res.data) setPolygonBatch(res.data);
      } catch {}
      setPolygonBatchLoading(false);
    }
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
      const yearStart = new Date(now.getTime() - 365 * 86400 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const endTime = now.toISOString().replace('T', ' ').substring(0, 19);

      if (device.type === 'weather') {
        const [r1, r2] = await Promise.allSettled([
          getEnvLatest(farmlandId, 'air_temperature,air_humidity,wind_speed,precipitation,light_intensity,atmospheric_pressure', 10),
          getEnvLatest(farmlandId, 'soil_temperature,soil_humidity,soil_ec', 10),
        ]);
        const merged: any = {};
        [r1, r2].forEach(r => {
          if (r.status === 'fulfilled' && r.value?.data) Object.assign(merged, r.value.data);
        });
        setDeviceData({ type: 'weather', ...merged });
      } else if (device.type === 'insect') {
        const res = await getInsectData(farmlandId, yearStart, endTime);
        setDeviceData(res.data);
      } else if (device.type === 'camera') {
        const allFarmlandIds = (binding.farmlandIds || []).join(',');
        const res = await getCameraList(baseId, allFarmlandIds);
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
    setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 300);
  };

  return (
    <section className={isFullScreen
      ? 'fixed inset-0 z-[100] bg-white'
      : 'relative overflow-hidden rounded-2xl shadow-sm'
    }
    style={isFullScreen ? {} : { height: '56vh', minHeight: '380px', maxHeight: '560px' }}
    >
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
        <div className="backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2 pointer-events-auto" style={{ background: 'rgba(236,253,245,0.95)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#d1fae5' }}>
            <MapIcon size={14} className="text-emerald-600" />
          </span>
          <span className="text-sm font-bold text-emerald-800">{binding?.siteName || 'A区 种植地'}</span>
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
        className={`fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl z-[101] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
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
              <span className="font-medium text-zinc-700">{selectedPolygon?.mapType || '—'}</span>
            </div>
            {polygonBatchLoading ? (
              <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
                <span className="text-zinc-400">批次信息</span>
                <span className="text-zinc-400 text-xs">加载中…</span>
              </div>
            ) : polygonBatch ? (
              <>
                <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
                  <span className="text-zinc-500">种植作物</span>
                  <span className="font-medium text-emerald-700">{polygonBatch.cropName || '—'}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
                  <span className="text-zinc-500">种植面积</span>
                  <span className="font-medium text-zinc-700">{polygonBatch.plantingArea != null ? `${polygonBatch.plantingArea} 亩` : '—'}</span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
                  <span className="text-zinc-500">种植周期</span>
                  <span className="font-medium text-zinc-700">
                    {polygonBatch.scheduledStartTime ? polygonBatch.scheduledStartTime.slice(0, 10) : '?'} ~ {polygonBatch.scheduledEndTime ? polygonBatch.scheduledEndTime.slice(0, 10) : '?'}
                  </span>
                </div>
                {polygonBatch.seedingMethod && (
                  <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
                    <span className="text-zinc-500">播种方式</span>
                    <span className="font-medium text-zinc-700">{polygonBatch.seedingMethod}</span>
                  </div>
                )}
              </>
            ) : null}
            {selectedPolygon?.remark && (
              <div className="flex justify-between text-sm py-2 border-b border-zinc-50">
                <span className="text-zinc-500">备注</span>
                <span className="font-medium text-zinc-700">{selectedPolygon.remark}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 设备信息 Bottom Sheet */}
      <div 
        className={`fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl z-[101] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
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
              {(() => {
                // 只显示当前点击设备对应的摄像头（按设备名匹配）
                const allCams = deviceData && deviceData.length > 0 ? deviceData : [];
                const deviceName = selectedDevice?.name || '';
                // 球机1 → 新疆球机1，球机2 → 新疆球机2，尝试名称匹配
                const matched = allCams.filter((cam: any) =>
                  cam.cameraName?.includes(deviceName) ||
                  deviceName.includes(cam.cameraName) ||
                  allCams.indexOf(cam) === (deviceName.includes('1') ? 0 : deviceName.includes('2') ? 1 : 0)
                );
                const cams = matched.length > 0 ? [matched[0]] : allCams.slice(0, 1);
                return cams.length > 0 ? cams.map((cam: any, idx: number) => (
                  <div key={idx} className="rounded-2xl overflow-hidden bg-black">
                    <div className="relative aspect-video flex items-center justify-center">
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                      </div>
                      {cam.status === 1 ? (
                        <HlsPlayer src={cam.hls || cam.videoUrl} cameraName={cam.cameraName} />
                      ) : (
                        <div className="text-zinc-500 text-sm">设备离线</div>
                      )}
                    </div>
                    <div className="px-3 py-2 bg-zinc-900">
                      <p className="text-xs text-zinc-300 font-medium">{cam.cameraName || `摄像头 ${idx + 1}`}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{cam.status === 1 ? '🟢 在线' : '🔴 离线'}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-zinc-500 text-sm text-center py-8">暂无视频流</div>
                );
              })()}
            </div>
          ) : selectedDevice?.type === 'insect' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">累计诱虫</span>
                <span className="text-2xl font-bold text-violet-700">{deviceData?.total != null ? deviceData.total.toLocaleString() : '—'}<span className="text-sm font-normal text-violet-400 ml-1">只</span></span>
              </div>
              {deviceData?.insect?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-400">虫害排行 Top 5</span>
                  {deviceData.insect.slice(0, 5).map((item: any, idx: number) => {
                    const pct = typeof item.percent === 'number' ? item.percent : (item.insectValue / (deviceData.total || 1)) * 100;
                    return (
                      <div key={idx} className="flex items-center gap-2" style={{ height: 18 }}>
                        <span className="text-[10px] text-zinc-400 w-3 text-right">{idx + 1}</span>
                        <span className="text-xs text-zinc-700 w-18 truncate">{item.insectName || '未知'}</span>
                        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-500 w-12 text-right">{item.insectValue}只</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(() => {
                const WDIMS = [
                  { dim: 'air_temperature', label: '空气温度', unit: '°C', bg: '#f0f9ff' },
                  { dim: 'air_humidity', label: '空气湿度', unit: '%', bg: '#ecfdf5' },
                  { dim: 'wind_speed', label: '风速', unit: 'm/s', bg: '#f0fdfa' },
                  { dim: 'precipitation', label: '降水量', unit: 'mm', bg: '#eef2ff' },
                  { dim: 'light_intensity', label: '光照强度', unit: 'lux', bg: '#fffbeb' },
                  { dim: 'atmospheric_pressure', label: '大气压', unit: 'hPa', bg: '#f8fafc' },
                  { dim: 'soil_temperature', label: '土壤温度', unit: '°C', bg: '#fffbeb' },
                  { dim: 'soil_humidity', label: '土壤水分', unit: '%', bg: '#f0f9ff' },
                  { dim: 'soil_ec', label: '土壤EC值', unit: 'μS/cm', bg: '#f5f3ff' },
                ];
                const lastVal = (arr: any[], key: string) => {
                  if (!arr?.length) return null;
                  for (let i = arr.length - 1; i >= Math.max(0, arr.length - 500); i--) {
                    const v = arr[i][key];
                    if (v != null && v !== 0) return v;
                  }
                  return null;
                };
                return WDIMS.map(d => {
                  const arr = deviceData?.[d.dim];
                  const val = Array.isArray(arr) ? lastVal(arr, d.dim) : null;
                  return (
                    <div key={d.dim} className="rounded-xl p-2.5 border border-zinc-100/60 flex flex-col justify-between" style={{ background: d.bg, height: 56 }}>
                      <span className="text-[10px] text-zinc-500 leading-none">{d.label}</span>
                      <span className="text-sm font-bold text-zinc-800 leading-none">
                        {val != null ? (typeof val === 'number' ? val.toFixed(1) : val) : '—'}<span className="text-[10px] font-normal text-zinc-400 ml-0.5">{d.unit}</span>
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
