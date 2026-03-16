import React, { useEffect, useMemo, useState } from 'react';
import { getHoireToken, getHoireDevices, getHoireInsectDevices, getHoireCameraDevices } from '../services/hoireService';

type SiteBindingResponse = {
  requestedSite: string;
  resolvedSite: string;
  fallback: boolean;
  binding: {
    siteName: string;
    weatherId: number;
    insectId: number;
    cameraId: number;
  };
};

export const HoireDebug: React.FC = () => {
  // TODO: 正式版将下线该调试面板，设备状态改为在地图区统一展示。
  console.log("HoireDebug 组件已加载 (v2)");
  const [devices, setDevices] = useState<{ type: string, list: any[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [siteBinding, setSiteBinding] = useState<SiteBindingResponse | null>(null);

  const siteKey = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('site') || 'base-current';
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getHoireToken();
      
      const [weatherDevices, insectDevices, cameraDevices, bindingRes] = await Promise.all([
        getHoireDevices(token),
        getHoireInsectDevices(token),
        getHoireCameraDevices(token),
        fetch(`/api/site-binding?site=${encodeURIComponent(siteKey)}`).then((res) => res.json())
      ]);

      setDevices([
        { type: '气象站', list: weatherDevices || [] },
        { type: '虫情设备', list: insectDevices || [] },
        { type: '摄像头', list: cameraDevices || [] }
      ]);

      setSiteBinding(bindingRes);

      if (bindingRes?.fallback) {
        setError(`未找到基地标识“${bindingRes.requestedSite}”，已回退到“${bindingRes.resolvedSite}”。`);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || '未知错误';
      setError(`获取物联网设备失败: ${errorMsg}`);
      console.error('Hoire API Error:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    console.log("开始执行订阅流程...");
    setSubscribing(true);
    try {
      const token = await getHoireToken();
      console.log("Token 获取成功:", token);

      const res = await fetch('/api/hoire/subscribe-by-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, site: siteKey })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || '按基地订阅失败');

      const messages = (data.results || []).map((item: any) => {
        const nameMap: Record<string, string> = {
          weather: '气象站',
          insect: '虫情设备',
          camera: '摄像头',
        };

        const label = nameMap[item.type] || item.type;
        if (item.status === 'fulfilled') {
          const code = item.data?.code;
          if (code === 0 || code === 1006) return `${label}订阅成功（${code === 1006 ? '已存在' : '新订阅'}）`;
          return `${label}订阅失败: ${item.data?.message || '未知错误'}`;
        }

        return `${label}订阅失败: ${item.reason || '未知错误'}`;
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

      {siteBinding && (
        <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-2 mb-4">
          当前基地: <span className="font-semibold">{siteBinding.binding.siteName}</span>
          （site={siteBinding.requestedSite} / resolved={siteBinding.resolvedSite}）
          {' '}| 绑定设备ID: weather={siteBinding.binding.weatherId}, insect={siteBinding.binding.insectId}, camera={siteBinding.binding.cameraId}
        </div>
      )}
      
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
