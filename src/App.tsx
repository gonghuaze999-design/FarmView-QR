/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { MapSection } from './components/MapSection';
import { TimelineSection } from './components/TimelineSection';
import { MonitoringSection } from './components/MonitoringSection';
import { JoinUsButton } from './components/JoinUsButton';
import { AdminPage } from './pages/AdminPage';
import { HoireDebug } from './components/HoireDebug';

type SiteBindingResponse = {
  requestedSite: string;
  resolvedSite: string;
  exists?: boolean;
  fallback: boolean;
  availableSites?: string[];
};

const UnknownSiteState: React.FC<{ siteKey: string; availableSites: string[] }> = ({ siteKey, availableSites }) => (
  <div className="min-h-screen bg-stone-50 pb-8 flex justify-center">
    <div className="w-full max-w-md bg-white shadow-lg min-h-screen">
      <Header />
      <main className="p-4 space-y-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-xl font-bold text-red-700 mb-2">站点不存在</h2>
          <p className="text-sm text-stone-700 leading-6">
            当前访问的站点标识 <span className="font-semibold">{siteKey}</span> 未配置。
          </p>
          <p className="text-sm text-stone-600 mt-2">请联系管理员配置站点，或先点击下方“我要加入”提交信息。</p>
          {availableSites.length > 0 && (
            <p className="text-xs text-stone-500 mt-3 break-all">
              已配置站点：{availableSites.join('、')}
            </p>
          )}
        </div>

        <JoinUsButton />
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

  useEffect(() => {
    const checkSite = async () => {
      try {
        const res = await fetch(`/api/site-binding?site=${encodeURIComponent(siteKey)}`);
        const data = (await res.json()) as SiteBindingResponse;
        setAvailableSites(data.availableSites || []);
        setSiteFound(Boolean(data.exists ?? !data.fallback));
      } catch (error) {
        console.error('Site check failed:', error);
        setSiteFound(true);
      } finally {
        setCheckingSite(false);
      }
    };

    checkSite();
  }, [siteKey]);

  if (checkingSite) {
    return (
      <div className="min-h-screen bg-stone-50 pb-8 flex justify-center">
        <div className="w-full max-w-md bg-white shadow-lg min-h-screen">
          <Header />
          <main className="p-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-stone-600">正在校验站点...</div>
          </main>
        </div>
      </div>
    );
  }

  if (!siteFound) {
    return <UnknownSiteState siteKey={siteKey} availableSites={availableSites} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-8 flex justify-center">
      <div className="w-full max-w-md bg-white shadow-lg min-h-screen">
        <Header />
        <main className="p-4 space-y-6">
          <HoireDebug />
          <MapSection />
          <TimelineSection />
          <MonitoringSection />
          <JoinUsButton />
        </main>
      </div>
    </div>
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
