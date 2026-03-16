import React from 'react';
import { ChevronDown } from 'lucide-react';

export const TimelineSection: React.FC = () => {
  return (
    <section className="farm-card p-6">
      <h2 className="text-xl font-bold mb-6 text-zinc-800">Agricultural Activities (2026)</h2>
      <div className="relative border-l-2 border-zinc-100 ml-2">
        <div className="mb-8 ml-6 relative">
          <div className="absolute -left-[33px] top-1 w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_0_4px_white]"></div>
          <h3 className="font-bold text-lg text-zinc-800">Planting</h3>
          <p className="text-sm text-zinc-500 font-medium mb-2">March 10, 2026</p>
          <p className="text-sm text-zinc-600 leading-relaxed">Initial planting of corn seeds across all plots.</p>
        </div>
        <div className="ml-6 relative">
          <div className="absolute -left-[33px] top-1 w-4 h-4 bg-zinc-200 rounded-full shadow-[0_0_0_4px_white]"></div>
          <h3 className="font-bold text-lg text-zinc-800">Fertilizing</h3>
          <p className="text-sm text-zinc-500 font-medium mb-3">April 15, 2026</p>
          <div className="text-sm mt-1 bg-zinc-50 border border-zinc-100 p-3 rounded-xl flex items-center justify-between text-zinc-600 cursor-pointer hover:bg-zinc-100 transition-colors">
            <span className="font-medium">Summary: Nitrogen application...</span>
            <ChevronDown size={18} className="text-zinc-400" />
          </div>
        </div>
      </div>
    </section>
  );
};
