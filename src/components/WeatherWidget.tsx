import React, { useState, useEffect } from 'react';
import { Cloud, Wind, Droplets, AlertTriangle, X, Thermometer, Gauge } from 'lucide-react';
import { fetchWeatherData, WeatherData } from '../services/weatherService';
import { useSiteContext } from '../contexts/SiteContext';

export const WeatherWidget: React.FC = () => {
  const { binding } = useSiteContext();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!binding?.baseId) return;

    // 用基地 ID 查地块列表，取农田中心点坐标
    const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';
    fetch(`/api/farm/land/list?baseId=${binding.baseId}`, {
      headers: { 'X-Site-Name': siteKey }
    })
      .then(r => r.json())
      .then(res => {
        if (res.code === 200 && res.data?.length > 0) {
          // 解析所有地块坐标，计算中心点
          let lngs: number[] = [], lats: number[] = [];
          res.data.forEach((land: any) => {
            if (land.mapPolygonGeo) {
              const match = land.mapPolygonGeo.match(/POLYGON\(\((.*?)\)\)/);
              if (match?.[1]) {
                match[1].split(',').forEach((p: string) => {
                  const [lng, lat] = p.trim().split(' ').map(Number);
                  if (lng && lat) { lngs.push(lng); lats.push(lat); }
                });
              }
            }
          });
          if (lngs.length > 0) {
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            return fetchWeatherData(centerLat, centerLng);
          }
        }
        throw new Error('无法获取农田坐标');
      })
      .then(data => setWeather(data))
      .catch(() => setError('无法获取天气数据'));
  }, [binding?.baseId]);

  if (error) return <div className="text-red-500 text-xs bg-red-50 px-3 py-1.5 rounded-full border border-red-100">{error}</div>;
  if (!weather) return <div className="text-xs text-zinc-400 bg-zinc-50 px-4 py-2 rounded-full border border-zinc-100 animate-pulse">加载天气...</div>;

  const isRaining = weather.current.temperature > 0 && weather.hourly.precipitation[0] > 0;
  const rainStopIndex = weather.hourly.precipitation.findIndex((p) => p === 0);
  const hoursUntilStop = rainStopIndex !== -1 ? rainStopIndex : null;

  const isHighWind = weather.hourly.windSpeed[0] > 40;
  const windStopIndex = weather.hourly.windSpeed.findIndex((s) => s <= 40);
  const hoursUntilWindStop = windStopIndex !== -1 ? windStopIndex : null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-all group"
      >
        <Cloud className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
        <span className="font-bold text-sm text-zinc-700">{weather.current.temperature}°C</span>
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-white rounded-3xl shadow-2xl shadow-zinc-200/50 p-6 border border-zinc-100 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-zinc-800">精准气象预报</h2>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 p-1.5 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {weather.alerts.length > 0 && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl mb-6">
              <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                <AlertTriangle className="w-5 h-5" />
                极端天气预警
              </div>
              <p className="text-sm text-red-600">{weather.alerts[0].event}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center gap-3 hover:bg-zinc-100 transition-colors">
              <div className="bg-orange-100 p-2 rounded-xl text-orange-500">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">气温</p>
                <p className="font-bold text-zinc-800">{weather.current.temperature}°C</p>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center gap-3 hover:bg-zinc-100 transition-colors">
              <div className="bg-blue-100 p-2 rounded-xl text-blue-500">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">风速</p>
                <p className="font-bold text-zinc-800">{weather.hourly.windSpeed[0]} km/h</p>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center gap-3 hover:bg-zinc-100 transition-colors">
              <div className="bg-sky-100 p-2 rounded-xl text-sky-500">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">降水</p>
                <p className="font-bold text-zinc-800">{weather.hourly.precipitation[0]} mm</p>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center gap-3 hover:bg-zinc-100 transition-colors">
              <div className="bg-purple-100 p-2 rounded-xl text-purple-500">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">天气码</p>
                <p className="font-bold text-zinc-800">{weather.current.weatherCode}</p>
              </div>
            </div>
          </div>

          {isRaining && hoursUntilStop !== null && (
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl mb-3 text-sm text-blue-700">
              🌧 预计 {hoursUntilStop} 小时后雨停
            </div>
          )}
          {isHighWind && hoursUntilWindStop !== null && (
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-sm text-amber-700">
              💨 大风预警，预计 {hoursUntilWindStop} 小时后风速降低
            </div>
          )}
        </div>
      )}
    </div>
  );
};
