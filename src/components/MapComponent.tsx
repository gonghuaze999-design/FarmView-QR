import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { MapPinOff } from 'lucide-react';

export const MapComponent = forwardRef(({ isFullScreen }: { isFullScreen: boolean }, ref) => {
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
    const amapKey = import.meta.env.VITE_AMAP_KEY;
    if (!amapKey) {
      setError('未配置高德地图 Key (VITE_AMAP_KEY)，无法加载地图');
      return;
    }

    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE || '',
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
        mapInstance.current = new AMap.Map(mapRef.current, {
          viewMode: '3D',
          zoom: 16,
          center: [116.397428, 39.90923], // 可以根据实际基地坐标修改
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
