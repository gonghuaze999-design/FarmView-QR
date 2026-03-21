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
import { JoinUsButton } from './components/JoinUsButton';
import { AdminPage } from './pages/AdminPage';
import { SiteProvider, SiteBinding } from './contexts/SiteContext';

type SiteBindingResponse = {
  requestedSite: string;
  resolvedSite: string;
  exists?: boolean;
  fallback: boolean;
  availableSites?: string[];
  binding?: SiteBinding;
};

const UnknownSiteState: React.FC<{ siteKey: string; availableSites: string[] }> = ({ siteKey, availableSites }) => (
  <div className=”min-h-screen bg-zinc-50 flex justify-center”>
    <div className=”w-full max-w-md bg-white shadow-2xl shadow-zinc-200/50 min-h-screen flex flex-col”>
      <div className=”bg-gradient-to-br from-emerald-600 to-teal-600 px-6 pt-16 pb-12 text-center”>
        <div className=”text-6xl mb-4”>🌾</div>
        <h1 className=”text-2xl font-bold text-white”>找不到该基地</h1>
        <p className=”text-emerald-100 text-sm mt-2”>链接中的基地标识无效或尚未配置</p>
      </div>
      <div className=”flex-1 px-6 py-8 space-y-6”>
        <div className=”bg-red-50 border border-red-100 rounded-2xl p-4”>
          <p className=”text-sm text-zinc-600 leading-relaxed”>
            当前访问的基地标识：
            <span className=”font-semibold mx-1 px-2 py-0.5 bg-red-100 rounded text-red-800”>{siteKey}</span>
            未找到对应配置。
          </p>
          <p className=”text-sm text-zinc-500 mt-2”>请检查链接是否正确，或联系为您提供链接的人员。</p>
        </div>
        {availableSites.filter(s => s !== 'base-current').length > 0 && (
          <div className=”bg-zinc-50 border border-zinc-100 rounded-2xl p-4”>
            <p className=”text-xs text-zinc-400 mb-2”>当前已配置基地：</p>
            <div className=”flex flex-wrap gap-2”>
              {availableSites.filter(s => s !== 'base-current').map(site => (
                <a key={site} href={`/?site=${site}`}
                  className=”px-3 py-1 bg-white rounded-full text-xs text-emerald-700 border border-emerald-200 shadow-sm hover:bg-emerald-50 transition-colors”>
                  {site}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className=”pt-2”>
          <p className=”text-center text-sm text-zinc-500 mb-3”>如有意向加入数字农业基地计划，欢迎提交申报信息</p>
          <JoinUsButton label=”我要申报基地” source=”apply” />
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

  if (checkingSite) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-8 flex justify-center">
        <div className="w-full max-w-md bg-white shadow-2xl shadow-zinc-200/50 min-h-screen">
          <Header />
          <main className="p-5">
            <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-6 text-zinc-500 flex items-center justify-center gap-3 shadow-sm">
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
      <div className="min-h-screen bg-zinc-50 pb-8 flex justify-center">
        <div className="w-full max-w-md bg-white shadow-2xl shadow-zinc-200/50 min-h-screen relative">
          <Header />
          <main className="p-5 space-y-6">
            <MapSection />
            <TimelineSection />
            <AgriMonitoringSection />
            <div className="pt-4 pb-8">
              <JoinUsButton />
            </div>
          </main>
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
