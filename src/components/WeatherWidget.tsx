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

  if (error) return <div className="text-red-500 text-xs">{error}</div>;
  if (!weather) return <div className="text-xs">加载中...</div>;

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
        className="bg-white px-4 py-2 rounded-full shadow-sm flex items-center gap-2 border border-stone-200 hover:bg-stone-50 transition-colors"
      >
        <Cloud className="w-4 h-4 text-blue-500" />
        <span className="font-medium text-sm">{weather.current.temperature}°C</span>
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-xl p-6 border border-stone-100 z-[60]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-stone-900">精准气象预报</h2>
            <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {weather.alerts.length > 0 && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-6">
              <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                <AlertTriangle className="w-5 h-5" />
                极端天气预警
              </div>
              <p className="text-sm text-red-600">{weather.alerts[0].event}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-stone-50 p-4 rounded-xl flex items-center gap-3">
              <Thermometer className="w-6 h-6 text-orange-500" />
              <div>
                <div className="text-xs text-stone-500">当前气温</div>
                <div className="font-bold text-lg">{weather.current.temperature}°C</div>
              </div>
            </div>
            <div className="bg-stone-50 p-4 rounded-xl flex items-center gap-3">
              <Gauge className="w-6 h-6 text-blue-500" />
              <div>
                <div className="text-xs text-stone-500">当前风速</div>
                <div className="font-bold text-lg">{weather.hourly.windSpeed[0]} km/h</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isRaining && (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <div className="flex items-center gap-2 font-bold text-blue-800">
                  <Droplets className="w-5 h-5" />
                  降雨中
                </div>
                <p className="text-sm text-blue-600 mt-1">预计 {hoursUntilStop} 小时后停止降雨</p>
              </div>
            )}

            {isHighWind && (
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                <div className="flex items-center gap-2 font-bold text-orange-800">
                  <Wind className="w-5 h-5" />
                  大风/沙尘预警
                </div>
                <p className="text-sm text-orange-600 mt-1">预计 {hoursUntilWindStop} 小时后风力减弱</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
