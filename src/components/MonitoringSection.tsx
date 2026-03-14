import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

export const MonitoringSection: React.FC = () => {
  const [iotData, setIotData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchIotData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/iot/latest');
      console.log('Fetching IoT data, response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched IoT data:', data);
        setIotData(data);
      } else {
        console.error('IoT API error:', response.statusText);
      }
    } catch (error) {
      console.error('获取物联网数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIotData();
    const interval = setInterval(fetchIotData, 5000); // 每5秒轮询一次
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="farm-card p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-stone-900">物联网设备实时数据</h2>
        <button 
          onClick={fetchIotData}
          className="text-xs bg-stone-800 text-white hover:bg-stone-900 px-3 py-1.5 rounded-md font-medium shadow-sm transition-colors"
        >
          手动刷新
        </button>
      </div>
      {loading ? (
        <p className="text-stone-500 text-sm">正在加载数据...</p>
      ) : !iotData ? (
        <p className="text-stone-500 text-sm">未找到设备数据 (请确保已触发推送)</p>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-stone-200 bg-white">
            <p className="text-sm text-stone-600">设备 ID: {iotData.data?.id ?? iotData.id ?? '未知'}</p>
            <p className="text-sm text-stone-600">时间: {iotData.data?.time || iotData.time ? new Date(iotData.data?.time || iotData.time).toLocaleString() : '未知'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(iotData.data?.data || iotData.data || []).map((item: any, i: number) => (
                <div key={i} className="p-2 bg-stone-100 rounded-lg">
                  <p className="text-xs text-stone-500">{item.name || '未知指标'}</p>
                  <p className="text-lg font-bold text-stone-900">{item.value ?? '--'} {item.unit || ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
