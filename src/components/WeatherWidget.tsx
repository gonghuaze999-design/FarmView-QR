import React, { useState, useEffect } from 'react';
import { Cloud, Wind, Droplets, AlertTriangle, X, Thermometer, Gauge } from 'lucide-react';
import { fetchWeatherData, WeatherData } from '../services/weatherService';

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const data = await fetchWeatherData(position.coords.latitude, position.coords.longitude);
            setWeather(data);
          } catch (err) {
            setError('无法获取天气数据');
          }
        },
        () => setError('无法获取位置信息')
      );
    } else {
      setError('浏览器不支持地理定位');
    }
  }, []);

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
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">当前气温</div>
                <div className="font-bold text-lg text-zinc-800">{weather.current.temperature}°C</div>
              </div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex items-center gap-3 hover:bg-zinc-100 transition-colors">
              <div className="bg-sky-100 p-2 rounded-xl text-sky-500">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">当前风速</div>
                <div className="font-bold text-lg text-zinc-800">{weather.hourly.windSpeed[0]} <span className="text-xs text-zinc-500 font-medium">km/h</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isRaining && (
              <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl">
                <div className="flex items-center gap-2 font-bold text-sky-800">
                  <Droplets className="w-5 h-5" />
                  降雨中
                </div>
                <p className="text-sm text-sky-600 mt-1 font-medium">预计 {hoursUntilStop} 小时后停止降雨</p>
              </div>
            )}

            {isHighWind && (
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                <div className="flex items-center gap-2 font-bold text-orange-800">
                  <Wind className="w-5 h-5" />
                  大风预警
                </div>
                <p className="text-sm text-orange-600 mt-1 font-medium">预计 {hoursUntilWindStop} 小时后风力减弱</p>
              </div>
            )}
            
            {!isRaining && !isHighWind && (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-emerald-800">天气良好</div>
                  <p className="text-xs text-emerald-600 mt-0.5 font-medium">适合进行农事活动</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
