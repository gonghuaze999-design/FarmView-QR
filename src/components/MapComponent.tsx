import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { MapPinOff } from 'lucide-react';

export interface DeviceMarker {
  id: string;
  type: 'weather' | 'insect' | 'camera';
  name: string;
  position: [number, number];
  status: 'online' | 'offline';
}

export const MapComponent = forwardRef(({ 
  isFullScreen, 
  center, 
  polygon, 
  polygons,
  devices,
  onPolygonClick,
  onDeviceClick
}: { 
  isFullScreen: boolean;
  center?: [number, number];
  polygon?: [number, number][];
  polygons?: any[];
  devices?: DeviceMarker[];
  onPolygonClick?: (polygonData?: any) => void;
  onDeviceClick?: (device: DeviceMarker) => void;
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useImperativeHandle(ref, () => ({
    resize: () => {
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    }
  }));

  useEffect(() => {
    const amapKey = (import.meta as any).env.VITE_AMAP_KEY;
    if (!amapKey) {
      setError('未配置高德地图 Key (VITE_AMAP_KEY)，无法加载地图');
      return;
    }

    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: (import.meta as any).env.VITE_AMAP_SECURITY_CODE || '',
    };

    // 加载地图脚本
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}`;
    script.async = true;
    
    script.onerror = () => {
      setError('高德地图脚本加载失败，请检查网络或 Key 是否正确');
    };

    document.head.appendChild(script);

    script.onload = () => {
      const AMap = (window as any).AMap;
      if (!AMap) {
        setError('高德地图加载失败');
        return;
      }
      
      try {
        const mapCenter = center || [116.397428, 39.90923];
        mapInstance.current = new AMap.Map(mapRef.current, {
          viewMode: '3D',
          zoom: 16,
          center: mapCenter,
          layers: [
            new AMap.TileLayer.Satellite(),
            new AMap.TileLayer.RoadNet()
          ]
        });

        // 添加工具栏
        AMap.plugin(['AMap.ToolBar', 'AMap.Scale'], () => {
          const toolbar = new AMap.ToolBar();
          const scale = new AMap.Scale();
          mapInstance.current.addControl(toolbar);
          mapInstance.current.addControl(scale);
        });
        
        setIsMapReady(true);
      } catch (err: any) {
        console.error(err);
        setError('地图初始化失败: ' + err.message);
      }
    };

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, []);

  // 监听数据变化并重绘
  useEffect(() => {
    if (!isMapReady || !mapInstance.current || !(window as any).AMap) return;
    const AMap = (window as any).AMap;

    // 清除现有的覆盖物
    mapInstance.current.clearMap();

    // 绘制多边形
    const allPolygons: any[] = [];
        
        if (polygons && polygons.length > 0) {
          polygons.forEach((pData) => {
            if (pData.coordinates && pData.coordinates.length > 0) {
              const polygonObj = new AMap.Polygon({
                path: pData.coordinates,
                fillColor: pData.backgroundColor || '#10b981',
                fillOpacity: (pData.transparency || 30) / 100,
                strokeColor: pData.borderColor || '#059669',
                strokeWeight: pData.borderWidth || 2,
                strokeStyle: 'solid',
                cursor: 'pointer',
              });
              
              polygonObj.on('click', () => {
                if (onPolygonClick) onPolygonClick(pData);
              });
              
              mapInstance.current.add(polygonObj);
              allPolygons.push(polygonObj);
            }
          });
        } else if (polygon && polygon.length > 0) {
          const polygonObj = new AMap.Polygon({
            path: polygon,
            fillColor: '#10b981', // emerald-500
            fillOpacity: 0.3,
            strokeColor: '#059669', // emerald-600
            strokeWeight: 2,
            strokeStyle: 'dashed',
            cursor: 'pointer',
          });
          
          mapInstance.current.add(polygonObj);
          
          if (onPolygonClick) {
            polygonObj.on('click', onPolygonClick);
          }
          
          allPolygons.push(polygonObj);
        }

        // 自动缩放地图到多边形可视范围
        if (allPolygons.length > 0) {
          mapInstance.current.setFitView(allPolygons);
        }

        // 绘制设备标记
        if (devices && devices.length > 0) {
          devices.forEach(device => {
            let iconColor = '#3b82f6'; // blue for weather
            let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 2.9-8 4.5 4.5 0 0 0-8.9-1.5 4.5 4.5 0 0 0-8.5 1.5 4.5 4.5 0 0 0 2.9 8z"/></svg>';
            
            if (device.type === 'insect') {
              iconColor = '#8b5cf6'; // violet for insect
              iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M17.47 9c1.93-.2 3.53-1.9 3.53-4"/><path d="M8 14H4"/><path d="M16 14h4"/><path d="M9.5 18c-2.3 1.2-4.5 1-6.5-.5"/><path d="M14.5 18c2.3 1.2 4.5 1 6.5-.5"/></svg>';
            } else if (device.type === 'camera') {
              iconColor = '#ef4444'; // red for camera
              iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
            }

            const markerContent = `
              <div style="background-color: ${iconColor}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid white;">
                ${iconSvg}
              </div>
            `;

            console.log('Creating marker for device:', device);
            if (isNaN(device.position[0]) || isNaN(device.position[1])) {
              console.error('Invalid device position:', device.position);
              return;
            }

            const marker = new AMap.Marker({
              position: device.position,
              content: markerContent,
              offset: new AMap.Pixel(-16, -16),
              extData: device
            });

            marker.on('click', (e: any) => {
              if (onDeviceClick) {
                onDeviceClick(e.target.getExtData());
              }
            });

            mapInstance.current.add(marker);
          });
        }
  }, [isMapReady, polygons, polygon, devices, onPolygonClick, onDeviceClick]);

  useEffect(() => {
    if (mapInstance.current) {
      // 延迟 resize 以确保容器尺寸已更新
      setTimeout(() => {
        mapInstance.current.resize();
      }, 100);
    }
  }, [isFullScreen]);

  if (error) {
    return (
      <div className="w-full h-full bg-zinc-100 flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
        <MapPinOff className="w-12 h-12 mb-3 text-zinc-400" />
        <p className="font-medium text-sm">{error}</p>
        <p className="text-xs mt-2 text-zinc-400">请在服务器的 .env 文件中配置 VITE_AMAP_KEY</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full bg-zinc-100 absolute inset-0 z-0 touch-pan-y" />;
});
