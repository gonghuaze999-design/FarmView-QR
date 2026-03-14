import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export const MapComponent = forwardRef(({ isFullScreen }: { isFullScreen: boolean }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    resize: () => {
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    }
  }));

  useEffect(() => {
    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
    };

    // 加载地图脚本
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${import.meta.env.VITE_AMAP_KEY}`;
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      const AMap = (window as any).AMap;
      mapInstance.current = new AMap.Map(mapRef.current, {
        viewMode: '3D',
        zoom: 11,
        center: [116.397428, 39.90923],
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
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.resize();
    }
  }, [isFullScreen]);

  return <div ref={mapRef} className="w-full h-full" />;
});
