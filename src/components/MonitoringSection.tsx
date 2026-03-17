import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Thermometer, Bug, CloudRain, Wind, Sun, Droplets, Zap } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { getFarmlandList, getEnvData, getInsectData } from '../services/api';

export const MonitoringSection: React.FC = () => {
  const { binding } = useSiteContext();
  const [weatherData, setWeatherData] = useState<any>(null);
  const [insectData, setInsectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchIotData = async () => {
    setIsRefreshing(true);
    try {
      const baseId = 1; // 默认 baseId
      const landRes = await getFarmlandList(baseId);
      let farmlandId = binding?.farmlandId || 12; // 默认使用 binding 中的 farmlandId 或 12
      
      if (landRes.code === 200 && landRes.data && landRes.data.length > 0) {
        farmlandId = landRes.data[0].id;
      }

      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const endTime = now.toISOString().replace('T', ' ').substring(0, 19);

      const [envRes, insectRes] = await Promise.all([
        getEnvData(farmlandId, startTime, endTime),
        getInsectData(farmlandId, startTime, endTime)
      ]);

      if (envRes.code === 200 && envRes.data && envRes.data.length > 0) {
        const latestEnv = envRes.data[0];
        setWeatherData({
          time: latestEnv.time || new Date().toISOString(),
          sensors: [
            { name: '空气温度', value: latestEnv.air_temperature, unit: '℃' },
            { name: '空气湿度', value: latestEnv.air_humidity, unit: '%' },
          ]
        });
      }

      if (insectRes.code === 200 && insectRes.data && insectRes.data.length > 0) {
        const latestInsect = insectRes.data[0];
        setInsectData({
          time: latestInsect.time || new Date().toISOString(),
          sensors: [
            { name: '今日诱虫量', value: latestInsect.insect_quantity, unit: '只' },
            { name: '主要害虫', value: latestInsect.main_pest || '无', unit: '' },
          ]
        });
      }

    } catch (error) {
      console.error('获取物联网数据失败:', error);
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchIotData();
    const interval = setInterval(fetchIotData, 60000); // 每分钟轮询一次
    return () => clearInterval(interval);
  }, [binding]);

  const hasAnyData = weatherData || insectData;

  const getIconForSensor = (name: string) => {
    if (name.includes('温度')) return <Thermometer size={16} className="text-blue-500" />;
    if (name.includes('湿度') || name.includes('水分')) return <Droplets size={16} className="text-emerald-500" />;
    if (name.includes('光照')) return <Sun size={16} className="text-amber-500" />;
    if (name.includes('风')) return <Wind size={16} className="text-teal-500" />;
    if (name.includes('雨') || name.includes('降水')) return <CloudRain size={16} className="text-indigo-500" />;
    if (name.includes('虫')) return <Bug size={16} className="text-violet-500" />;
    return <Zap size={16} className="text-zinc-400" />;
  };

  return (
    <section className="farm-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Activity className="text-emerald-500" size={20} />
          <h2 className="text-xl font-bold text-zinc-800">物联网实时监控</h2>
        </div>
        <div className="flex gap-2">
          {!hasAnyData && !loading && (
            <button 
              onClick={fetchIotData}
              className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-full font-medium transition-all"
            >
              重新获取
            </button>
          )}
          <button 
            onClick={fetchIotData}
            className="text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
            刷新
          </button>
        </div>
      </div>

      {loading && !hasAnyData ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <RefreshCw size={24} className="animate-spin mb-3 text-zinc-300" />
          <p className="text-sm">正在获取真实设备数据...</p>
        </div>
      ) : !hasAnyData ? (
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Activity size={24} className="text-zinc-300" />
          </div>
          <p className="text-zinc-600 font-medium mb-1">暂无设备数据</p>
          <p className="text-zinc-400 text-xs mb-4">设备可能离线，或尚未上传数据</p>
          <button 
            onClick={fetchIotData}
            className="text-sm bg-emerald-500 text-white hover:bg-emerald-600 px-5 py-2 rounded-full font-medium transition-all shadow-sm shadow-emerald-500/20"
          >
            重试获取数据
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 气象站数据 */}
          {weatherData && (
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
              <div className="bg-blue-50/50 px-4 py-3 border-b border-zinc-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                  <span className="font-bold text-zinc-800 text-sm">气象站 (ID: {binding?.weatherId})</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  更新于: {new Date(weatherData.time).toLocaleTimeString()}
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {weatherData.sensors.map((item: any, i: number) => (
                  <div key={i} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {getIconForSensor(item.name)}
                      <span className="text-xs font-medium text-zinc-500">{item.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-zinc-800">{item.value ?? '--'}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 虫情站数据 */}
          {insectData && (
            <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
              <div className="bg-violet-50/50 px-4 py-3 border-b border-zinc-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
                  <span className="font-bold text-zinc-800 text-sm">虫情测报站 (ID: {binding?.insectId})</span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  更新于: {new Date(insectData.time).toLocaleTimeString()}
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {insectData.sensors.map((item: any, i: number) => (
                  <div key={i} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {getIconForSensor(item.name)}
                      <span className="text-xs font-medium text-zinc-500">{item.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-zinc-800">{item.value ?? '--'}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
