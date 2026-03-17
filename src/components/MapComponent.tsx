import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { MapPinOff } from 'lucide-react';

export interface DeviceMarker {
  id: string;
  type: 'weather' | 'soil' | 'camera';
  name: string;
  position: [number, number];
  status: 'online' | 'offline';
}

export const MapComponent = forwardRef(({ 
  isFullScreen, 
  center, 
  polygon, 
  devices,
  onPolygonClick,
  onDeviceClick
}: { 
  isFullScreen: boolean;
  center?: [number, number];
  polygon?: [number, number][];
  devices?: DeviceMarker[];
  onPolygonClick?: () => void;
  onDeviceClick?: (device: DeviceMarker) => void;
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

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

        // 绘制多边形
        if (polygon && polygon.length > 0) {
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
          
          // 自动缩放地图到多边形可视范围
          mapInstance.current.setFitView([polygonObj]);
        }

        // 绘制设备标记
        if (devices && devices.length > 0) {
          devices.forEach(device => {
            let iconColor = '#3b82f6'; // blue for weather
            let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 2.9-8 4.5 4.5 0 0 0-8.9-1.5 4.5 4.5 0 0 0-8.5 1.5 4.5 4.5 0 0 0 2.9 8z"/></svg>';
            
            if (device.type === 'soil') {
              iconColor = '#d97706'; // amber for soil
              iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';
            } else if (device.type === 'camera') {
              iconColor = '#ef4444'; // red for camera
              iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>';
            }

            const markerContent = `
              <div style="background-color: ${iconColor}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid white;">
                ${iconSvg}
              </div>
            `;

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
      } catch (err: any) {
        console.error(err);
        setError('地图初始化失败: ' + err.message);
      }
    };

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
      }
      // 移除 script 标签可能会导致其他依赖 AMap 的组件报错，这里仅销毁实例
    };
  }, []);

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

  return <div ref={mapRef} className="w-full h-full bg-zinc-100 absolute inset-0 z-0" />;
});
