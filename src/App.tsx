/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { MapSection } from './components/MapSection';
import { TimelineSection } from './components/TimelineSection';
import { MonitoringSection } from './components/MonitoringSection';
import { JoinUsButton } from './components/JoinUsButton';
import { AdminPage } from './pages/AdminPage';

import { WeatherWidget } from './components/WeatherWidget';
import { HoireDebug } from './components/HoireDebug';

const AppContent = () => (
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
