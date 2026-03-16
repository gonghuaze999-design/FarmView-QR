import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

export const MonitoringSection: React.FC = () => {
  const [iotData, setIotData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchIotData = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/iot/latest');
      if (response.ok) {
        const data = await response.json();
        setIotData(data);
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
    const interval = setInterval(fetchIotData, 5000); // 每5秒轮询一次
    return () => clearInterval(interval);
  }, []);

  // 提取实际的传感器数据数组
  const getSensorData = () => {
    if (!iotData) return [];
    // 兼容不同的数据结构
    if (Array.isArray(iotData.data?.data)) return iotData.data.data;
    if (Array.isArray(iotData.data)) return iotData.data;
    if (Array.isArray(iotData)) return iotData;
    return [];
  };

  const sensorData = getSensorData();

  return (
    <section className="farm-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Activity className="text-emerald-500" size={20} />
          <h2 className="text-xl font-bold text-zinc-800">物联网实时监控</h2>
        </div>
        <button 
          onClick={fetchIotData}
          className="text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
          刷新
        </button>
      </div>
      {loading && !iotData ? (
        <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
          <RefreshCw size={24} className="animate-spin mb-2 text-zinc-300" />
          <p className="text-sm">正在连接设备...</p>
        </div>
      ) : !iotData || sensorData.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-6 text-center">
          <p className="text-zinc-500 text-sm mb-1">暂无设备数据</p>
          <p className="text-zinc-400 text-xs">请确保传感器已连接并正在推送数据</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-zinc-100 bg-zinc-50/50">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">设备 ID</p>
                <p className="text-sm text-zinc-700 font-mono">{iotData.data?.id ?? iotData.id ?? '未知'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">更新时间</p>
                <p className="text-sm text-zinc-700">{iotData.data?.time || iotData.time ? new Date(iotData.data?.time || iotData.time).toLocaleString() : '未知'}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {sensorData.map((item: any, i: number) => (
                <div key={i} className="p-4 bg-white border border-zinc-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-medium text-zinc-500 mb-1">{item.name || '未知指标'}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-zinc-800">{item.value ?? '--'}</p>
                    <span className="text-xs text-zinc-400 font-medium">{item.unit || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
