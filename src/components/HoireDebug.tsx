import React, { useEffect, useMemo, useState } from 'react';
import { getHoireToken, getHoireDevices, getHoireInsectDevices, getHoireCameraDevices } from '../services/hoireService';
import { Settings2, RefreshCw, Link2, FileJson, Activity, List } from 'lucide-react';

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
  console.log("HoireDebug 组件已加载 (v2)");
  const [activeTab, setActiveTab] = useState<'devices' | 'raw-data'>('devices');
  const [devices, setDevices] = useState<{ type: string, list: any[] }[]>([]);
  const [rawData, setRawData] = useState<Record<string, any[]>>({});
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
      if (activeTab === 'devices') {
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
      } else {
        const res = await fetch('/api/iot/raw-data');
        const data = await res.json();
        setRawData(data);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || '未知错误';
      setError(`获取数据失败: ${errorMsg}`);
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
  }, [activeTab]);

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
      <div className="flex justify-between items-center mb-4">
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
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-zinc-100 pb-2">
        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'devices' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <List size={16} />
          设备列表
        </button>
        <button
          onClick={() => setActiveTab('raw-data')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'raw-data' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
        >
          <Activity size={16} />
          实时推送数据
        </button>
      </div>
      
      {error && (
        <div className="text-red-600 p-4 bg-red-50 border border-red-100 rounded-xl mb-5 text-sm font-medium">
          {error}
        </div>
      )}

      {activeTab === 'devices' && (
        <>
          {siteBinding && (
            <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-xl p-4 mb-5 leading-relaxed">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-zinc-800">当前基地:</span>
                <span className="px-2 py-0.5 bg-white border border-zinc-200 rounded-md shadow-sm">{siteBinding.binding.siteName}</span>
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
        </>
      )}

      {activeTab === 'raw-data' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 mb-4 bg-blue-50 text-blue-700 p-3 rounded-lg border border-blue-100">
            <strong>提示：</strong> 这里显示的是 Hoire 平台主动推送到服务器的原始数据。请先点击右上角“订阅设备”，等待几分钟后点击“刷新”查看最新数据。每个设备最多保留最近 5 条记录。
          </div>
          {Object.keys(rawData).length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-sm">暂无任何设备推送数据</div>
          ) : (
            Object.entries(rawData).map(([deviceId, payloads]) => (
              <div key={deviceId} className="border border-zinc-100 rounded-xl overflow-hidden">
                <div className="bg-zinc-50 px-4 py-2 border-b border-zinc-100 flex justify-between items-center">
                  <h3 className="font-semibold text-zinc-700 text-sm">设备 ID: {deviceId}</h3>
                  <span className="text-xs font-medium bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">{payloads.length} 条记录</span>
                </div>
                <div className="p-4 bg-white space-y-4">
                  {payloads.map((item, index) => (
                    <div key={index} className="border border-zinc-100 rounded-lg overflow-hidden">
                      <div className="bg-zinc-50 px-3 py-1.5 text-[10px] text-zinc-500 border-b border-zinc-100">
                        接收时间: {new Date(item.receiveTime).toLocaleString()}
                      </div>
                      <pre className="p-3 text-[10px] overflow-x-auto text-zinc-600">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
