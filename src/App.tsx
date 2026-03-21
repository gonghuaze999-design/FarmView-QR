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
  <div className="min-h-screen bg-zinc-50 pb-8 flex justify-center">
    <div className="w-full max-w-md bg-white shadow-2xl shadow-zinc-200/50 min-h-screen relative">
      <Header />
      <main className="p-5 space-y-6">
        <div className="rounded-3xl border border-red-100 bg-red-50/50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-red-700 mb-3">基地不存在</h2>
          <p className="text-sm text-zinc-700 leading-relaxed">
            当前访问的基地标识 <span className="font-semibold px-2 py-0.5 bg-red-100 rounded text-red-800">{siteKey}</span> 未配置。
          </p>
          <p className="text-sm text-zinc-600 mt-4 leading-relaxed">请联系管理员配置基地，或先点击下方“我要申报基地”提交信息。</p>
          {availableSites.length > 0 && (
            <div className="mt-5 pt-4 border-t border-red-100/50">
              <p className="text-xs text-zinc-500 mb-2">已配置基地：</p>
              <div className="flex flex-wrap gap-2">
                {availableSites.map(site => (
                  <span key={site} className="px-2 py-1 bg-white rounded-md text-xs text-zinc-600 border border-zinc-200 shadow-sm">{site}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <JoinUsButton label="我要申报基地" />
      </main>
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
