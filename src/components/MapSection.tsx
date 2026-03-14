import React, { useState, useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
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
    <section className={`farm-card p-4 relative ${isFullScreen ? 'fixed inset-0 z-[100] rounded-none' : 'h-96'}`}>
      <div className="absolute inset-0">
        <MapComponent isFullScreen={isFullScreen} ref={mapRef} />
      </div>
      <button 
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 bg-white/80 p-2 rounded-lg shadow-md hover:bg-white z-10"
      >
        {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
      <div className="absolute bottom-4 left-4 bg-white/90 p-2 rounded-lg shadow-md text-xs z-10">
        <p>Plot A: 10.5 acres</p>
        <p>Crop: Corn</p>
      </div>
    </section>
  );
};
