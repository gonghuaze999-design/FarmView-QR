/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { MapSection } from './components/MapSection';
import { TimelineSection } from './components/TimelineSection';
import { AgriMonitoringSection } from './components/AgriMonitoringSection';
import { MonitoringSection } from './components/MonitoringSection';
import { CameraTab } from './components/CameraTab';
import { AiFloatingBall } from './components/AiFloatingBall';
import { AiChatPanel } from './components/AiChatPanel';
import { JoinUsButton } from './components/JoinUsButton';
import { TabBar, type TabKey } from './components/TabBar';
import { AdminPage } from './pages/AdminPage';
import { SiteProvider, SiteBinding } from './contexts/SiteContext';
import { getBaseData, getMainCrop, getCropGrowth, getDeviceCountByType, getCameraCount, getFarmlandList } from './services/api';

type SiteBindingResponse = {
  requestedSite: string;
  resolvedSite: string;
  exists?: boolean;
  fallback: boolean;
  availableSites?: string[];
  binding?: SiteBinding;
};

const UnknownSiteState: React.FC<{ siteKey: string; availableSites: string[] }> = ({ siteKey, availableSites }) => (
  <div className="min-h-screen flex justify-center" style={{ background: '#faf9f6' }}>
    <div className="w-full max-w-md shadow-xl min-h-screen flex flex-col" style={{ background: '#fffdf7', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 pt-16 pb-12 text-center">
        <div className="text-6xl mb-4">🌾</div>
        <h1 className="text-2xl font-bold text-white">找不到该基地</h1>
        <p className="text-emerald-100 text-sm mt-2">链接中的基地标识无效或尚未配置</p>
      </div>
      <div className="flex-1 px-6 py-8 space-y-6">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-sm text-zinc-600 leading-relaxed">
            当前访问的基地标识：
            <span className="font-semibold mx-1 px-2 py-0.5 bg-red-100 rounded text-red-800">{siteKey}</span>
            未找到对应配置。
          </p>
          <p className="text-sm text-zinc-500 mt-2">请检查链接是否正确，或联系为您提供链接的人员。</p>
        </div>
        {availableSites.filter(s => s !== 'base-current').length > 0 && (
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-2">当前已配置基地：</p>
            <div className="flex flex-wrap gap-2">
              {availableSites.filter(s => s !== 'base-current').map(site => (
                <a key={site} href={`/?site=${site}`}
                  className="px-3 py-1 bg-white rounded-full text-xs text-emerald-700 border border-emerald-200 shadow-sm hover:bg-emerald-50 transition-colors">
                  {site}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2">
          <p className="text-center text-sm text-zinc-500 mb-3">如有意向加入数字农业基地计划，欢迎提交申报信息</p>
          <JoinUsButton label="我要申报基地" source="apply" />
        </div>
      </div>
    </div>
  </div>
);

const AppContent = () => {
  const siteKey = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('site') || 'base-current';
  }, []);

  const [checkingSite, setCheckingSite] = useState(true);
  const [siteFound, setSiteFound] = useState(true);
  const [availableSites, setAvailableSites] = useState<string[]>([]);
  const [siteBinding, setSiteBinding] = useState<SiteBinding | null>(null);

  useEffect(() => {
    const checkSite = async () => {
      try {
        const res = await fetch(`/api/site-binding?site=${encodeURIComponent(siteKey)}`);
        const data = (await res.json()) as SiteBindingResponse;
        setAvailableSites(data.availableSites || []);
        setSiteFound(Boolean(data.exists ?? !data.fallback));
        setSiteBinding(data.binding || null);
      } catch (error) {
        console.error('Site check failed:', error);
        setSiteFound(true);
      } finally {
        setCheckingSite(false);
      }
    };

    checkSite();
  }, [siteKey]);

  // 动态更新页面标题为基地名称
  useEffect(() => {
    if (siteBinding?.siteName) {
      document.title = siteBinding.siteName;
    }
  }, [siteBinding]);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showAiChat, setShowAiChat] = useState(false);

  // 总览指标数据
  const [overviewStats, setOverviewStats] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!siteBinding?.baseId) return;
    const baseId = siteBinding.baseId;
    const dash = '—';
    Promise.allSettled([
      getBaseData(baseId).then(r => r.code === 200 && r.data ? String(r.data.landAccount) : dash).catch(() => dash),
      getFarmlandList(baseId).then(r => {
        if (r.code === 200 && Array.isArray(r.data)) {
          const total = r.data.reduce((s: number, l: any) => s + (Number(l.size) || 0), 0);
          return `${total.toFixed(0)}`;
        }
        return dash;
      }).catch(() => dash),
      getMainCrop(baseId).then(r => r.code === 200 && r.msg ? r.msg : dash).catch(() => dash),
      getCropGrowth(baseId).then(r => {
        if (r.code === 200 && r.data) {
          const firstCrop = Object.values(r.data)[0];
          return firstCrop?.[0]?.growthName || dash;
        }
        return dash;
      }).catch(() => dash),
      getDeviceCountByType(baseId).then(r => {
        if (r.code === 200 && Array.isArray(r.data)) {
          return String(r.data.reduce((s, t) => s + (t.count || 0), 0));
        }
        return dash;
      }).catch(() => dash),
      getCameraCount(baseId).then(r => r.code === 200 && r.data != null ? String(r.data) : dash).catch(() => dash),
    ]).then(([land, area, crop, growth, device, camera]) => {
      setOverviewStats({
        landCount: land.status === 'fulfilled' ? String(land.value) : dash,
        area: area.status === 'fulfilled' ? String(area.value) : dash,
        crop: crop.status === 'fulfilled' ? String(crop.value) : dash,
        growthStage: growth.status === 'fulfilled' ? String(growth.value) : dash,
        deviceCount: device.status === 'fulfilled' ? String(device.value) : dash,
        cameraCount: camera.status === 'fulfilled' ? String(camera.value) : dash,
      });
    });
  }, [siteBinding?.baseId]);

  if (checkingSite) {
    return (
      <div className="min-h-screen pb-8 flex justify-center" style={{ background: '#faf9f6' }}>
        <div className="w-full max-w-md bg-white shadow-xl min-h-screen" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
          <Header />
          <main className="p-5">
            <div className="rounded-3xl border p-6 flex items-center justify-center gap-3 shadow-sm" style={{ borderColor: '#f0f0eb', background: '#f9fafb', color: '#64748b' }}>
              <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
              正在校验站点...
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!siteFound) {
    return <UnknownSiteState siteKey={siteKey} availableSites={availableSites} />;
  }

  return (
    <SiteProvider siteKey={siteKey} binding={siteBinding}>
      <div className="min-h-screen pb-8 flex justify-center" style={{ background: 'linear-gradient(180deg, #fef9ef 0%, #f8f6f0 100%)' }}>
        <div className="w-full max-w-md shadow-xl min-h-screen relative" style={{ background: '#fffdf7', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
          <Header />
          <main className="pb-20 pt-[77px]" style={{ background: '#fffdf7' }}>
            {activeTab === 'overview' && (
              <div className="px-4 pb-6 space-y-3">
                <MapSection />
                {/* 基地信息卡 — 三列，统一风格(彩色底色+左边框点缀) */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: '当前作物', key: 'crop', icon: '🌱', color: '#059669', bg: '#ecfdf5' },
                    { label: '种植面积', key: 'area', unit: '亩', icon: '📐', color: '#0284c7', bg: '#f0f9ff' },
                    { label: '生育期', key: 'growthStage', icon: '🌿', color: '#b45309', bg: '#fef3c7' },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3 overflow-hidden" style={{ background: item.bg }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[10px] font-medium opacity-65" style={{ color: item.color }}>{item.label}</span>
                      </div>
                      <div className="text-lg font-bold" style={{ color: item.color }}>
                        {overviewStats[item.key] ?? '—'}
                        {item.unit && <span className="text-xs font-normal ml-0.5 opacity-50">{item.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* 统计卡 — 同风格，彩色底色 */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: '地块', key: 'landCount', icon: '🗺️', color: '#10b981', bg: '#ecfdf5' },
                    { label: '设备', key: 'deviceCount', icon: '📡', color: '#0ea5e9', bg: '#f0f9ff' },
                    { label: '摄像头', key: 'cameraCount', icon: '📷', color: '#f43f5e', bg: '#fff1f2' },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: item.bg }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-[10px] font-medium opacity-65" style={{ color: item.color }}>{item.label}</span>
                      </div>
                      <div className="text-lg font-bold" style={{ color: item.color }}>{overviewStats[item.key] ?? '—'}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-1.5">
                  <JoinUsButton compact />
                </div>
              </div>
            )}
            {activeTab === 'camera' && (
              <div className="px-4 pb-6">
                <CameraTab />
              </div>
            )}
            {activeTab === 'agri' && (
              <div className="px-4 pb-6 space-y-4">
                <TimelineSection />
                <AgriMonitoringSection />
              </div>
            )}
            {activeTab === 'data' && (
              <div className="px-4 pb-6 space-y-4">
                <MonitoringSection />
              </div>
            )}
          </main>
          <TabBar active={activeTab} onChange={setActiveTab} />
          <AiFloatingBall onClick={() => setShowAiChat(true)} />
          {showAiChat && <AiChatPanel onClose={() => setShowAiChat(false)} />}
        </div>
      </div>
    </SiteProvider>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
