import React, { useEffect, useMemo, useState } from 'react';
import { getHoireToken, getHoireDevices, getHoireInsectDevices, getHoireCameraDevices } from '../services/hoireService';
import { DEFAULT_SITE_KEY, SITE_DEVICE_BINDINGS } from '../config/siteDeviceBindings';

export const HoireDebug: React.FC = () => {
  // TODO: 正式版将下线该调试面板，设备状态改为在地图区统一展示。
  console.log("HoireDebug 组件已加载 (v2)");
  const [devices, setDevices] = useState<{ type: string, list: any[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const siteKey = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('site') || DEFAULT_SITE_KEY;
  }, []);

  const selectedSite = SITE_DEVICE_BINDINGS[siteKey] || SITE_DEVICE_BINDINGS[DEFAULT_SITE_KEY];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getHoireToken();
      
      const [weatherDevices, insectDevices, cameraDevices] = await Promise.all([
        getHoireDevices(token),
        getHoireInsectDevices(token),
        getHoireCameraDevices(token)
      ]);

      setDevices([
        { type: '气象站', list: weatherDevices || [] },
        { type: '虫情设备', list: insectDevices || [] },
        { type: '摄像头', list: cameraDevices || [] }
      ]);

      if (!SITE_DEVICE_BINDINGS[siteKey]) {
        setError(`未找到基地标识“${siteKey}”，已回退到默认基地“${DEFAULT_SITE_KEY}”。`);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || '未知错误';
      setError(`获取物联网设备失败: ${errorMsg}`);
      console.error('Hoire API Error:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToDevice = async (token: string, id: number, type: string) => {
    const response = await fetch('/api/hoire/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, id, type })
    });
    
    // 获取响应数据
    const data = await response.json();
    
    // 如果响应不成功，且不是 1006（已订阅），才抛出异常
    if (!response.ok && data.code !== 1006) {
      throw new Error(data.details || data.message || '订阅失败');
    }
    
    // 即使 response.ok 为 false，如果是 1006，我们也返回 data
    return data;
  };

  const handleSubscribe = async () => {
    console.log("开始执行订阅流程...");
    setSubscribing(true);
    try {
      const token = await getHoireToken();
      console.log("Token 获取成功:", token);
      
      const results = await Promise.allSettled([
        subscribeToDevice(token, selectedSite.weatherId, 'weather'),
        subscribeToDevice(token, selectedSite.insectId, 'insect'),
        subscribeToDevice(token, selectedSite.cameraId, 'camera')
      ]);
      
      console.log("订阅请求结果:", results);
      
      // 直接在控制台打印详细结果，方便调试
      console.log("详细订阅结果:", JSON.stringify(results, null, 2));
      
      const messages = results.map((res, i) => {
        const names = ['气象站', '虫情设备', '摄像头'];
        if (res.status === 'fulfilled') {
          const data = res.value;
          // 如果 code 为 1006，说明已经订阅过，视为成功
          if (data.code === 1006 || data.code === 0) {
            return `${names[i]}订阅成功（已存在）`;
          }
          return `${names[i]}订阅失败: ${data.message || '未知错误'}`;
        }
        return `${names[i]}订阅失败: ${res.reason.message}`;
      });
      
      alert(messages.join('\n'));
    } catch (err: any) {
      console.error("订阅流程捕获到异常:", err);
      alert(`订阅过程发生严重错误: ${err.message}`);
    } finally {
      setSubscribing(false);
      console.log("订阅流程结束。");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="p-4 text-stone-500">正在连接物联网平台...</div>;

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-stone-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-stone-900">物联网设备列表（调试）</h2>
        <div className="flex gap-2">
          <button 
            onClick={fetchData}
            className="text-xs bg-stone-100 text-stone-800 hover:bg-stone-200 px-3 py-1.5 rounded-md font-medium transition-colors"
          >
            刷新
          </button>
          <button 
            onClick={handleSubscribe}
            disabled={subscribing}
            className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-md font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {subscribing ? '订阅中...' : '订阅所选设备'}
          </button>
          <button 
            onClick={async () => {
              try {
                const res = await fetch('/api/hoire/last-subscription-result');
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              } catch { alert("无法获取结果"); }
            }}
            className="text-xs bg-stone-600 text-white hover:bg-stone-700 px-3 py-1.5 rounded-md font-medium shadow-sm transition-colors"
          >
            查看订阅详情
          </button>
        </div>
      </div>
      {error && <div className="text-red-500 p-4 bg-red-50 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-2 mb-4">
        当前基地: <span className="font-semibold">{selectedSite.siteName}</span>（site={siteKey}） | 绑定设备ID: weather={selectedSite.weatherId}, insect={selectedSite.insectId}, camera={selectedSite.cameraId}
      </div>
      
      <div className="space-y-4">
        {devices.map((group) => (
          <div key={group.type}>
            <h3 className="font-semibold text-stone-700 text-sm mb-2">{group.type} ({group.list.length})</h3>
            {group.list.length === 0 ? (
              <p className="text-stone-400 text-xs">无设备</p>
            ) : (
              <pre className="bg-stone-100 p-3 rounded-lg text-[10px] overflow-x-auto">
                {JSON.stringify(group.list, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
