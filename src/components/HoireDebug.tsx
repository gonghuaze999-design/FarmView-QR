import React, { useEffect, useMemo, useState } from 'react';
import { getHoireToken, getHoireDevices, getHoireInsectDevices, getHoireCameraDevices } from '../services/hoireService';
import { Settings2, RefreshCw, Link2, FileJson } from 'lucide-react';

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const siteKey = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('site') || 'base-current';
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [weatherDevices, insectDevices, cameraDevices, bindingRes] = await Promise.all([
        getHoireDevices(),
        getHoireInsectDevices(),
        getHoireCameraDevices(),
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
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleSubscribe = async () => {
    console.log("开始执行订阅流程...");
    setSubscribing(true);
    try {
      const res = await fetch('/api/hoire/subscribe-by-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: siteKey })
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

  if (loading) {
    return (
      <div className="farm-card p-6 flex flex-col items-center justify-center text-zinc-400 py-8">
        <RefreshCw size={24} className="animate-spin mb-3 text-zinc-300" />
        <p className="text-sm font-medium">正在连接物联网平台...</p>
      </div>
    );
  }

  return (
    <div className="farm-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Settings2 className="text-zinc-400" size={20} />
          <h2 className="text-lg font-bold text-zinc-800">设备调试面板</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchData}
            className="p-2 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 rounded-full transition-colors"
            title="刷新"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={handleSubscribe}
            disabled={subscribing}
            className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-full font-medium shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Link2 size={14} />
            {subscribing ? '订阅中...' : '订阅设备'}
          </button>
          <button 
            onClick={async () => {
              try {
                const res = await fetch('/api/hoire/last-subscription-result');
                const data = await res.json();
                alert(JSON.stringify(data, null, 2));
              } catch { alert("无法获取结果"); }
            }}
            className="text-xs bg-zinc-800 text-white hover:bg-zinc-900 px-3 py-1.5 rounded-full font-medium shadow-sm transition-colors flex items-center gap-1.5"
          >
            <FileJson size={14} />
            详情
          </button>
        </div>
      </div>
      
      {error && (
        <div className="text-red-600 p-4 bg-red-50 border border-red-100 rounded-xl mb-5 text-sm font-medium">
          {error}
        </div>
      )}

      {siteBinding && (
        <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-xl p-4 mb-5 leading-relaxed">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-zinc-800">当前基地:</span>
            <span className="px-2 py-0.5 bg-white border border-zinc-200 rounded-md shadow-sm">{siteBinding.binding.siteName}</span>
          </div>
          <div className="text-zinc-500 mb-2">
            请求标识: <code className="bg-zinc-100 px-1 rounded">{siteBinding.requestedSite}</code> / 
            解析标识: <code className="bg-zinc-100 px-1 rounded">{siteBinding.resolvedSite}</code>
          </div>
          <div className="flex gap-3 flex-wrap">
            <span className="bg-white px-2 py-1 rounded-md border border-zinc-200 shadow-sm">气象站: {siteBinding.binding.weatherId}</span>
            <span className="bg-white px-2 py-1 rounded-md border border-zinc-200 shadow-sm">虫情: {siteBinding.binding.insectId}</span>
            <span className="bg-white px-2 py-1 rounded-md border border-zinc-200 shadow-sm">监控: {siteBinding.binding.cameraId}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {devices.map((group) => (
          <div key={group.type} className="border border-zinc-100 rounded-xl overflow-hidden">
            <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100 flex justify-between items-center">
              <h3 className="font-semibold text-zinc-700 text-sm">{group.type}</h3>
              <span className="text-xs font-medium bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">{group.list.length}</span>
            </div>
            <div className="p-4 bg-white">
              {group.list.length === 0 ? (
                <p className="text-zinc-400 text-xs text-center py-2">无设备</p>
              ) : (
                <pre className="bg-zinc-50 p-3 rounded-lg text-[10px] overflow-x-auto text-zinc-600 border border-zinc-100">
                  {JSON.stringify(group.list, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
