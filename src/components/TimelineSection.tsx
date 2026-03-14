import React from 'react';
import { ChevronDown } from 'lucide-react';

export const TimelineSection: React.FC = () => {
  return (
    <section className="p-4 bg-white rounded-xl shadow-sm">
      <h2 className="text-lg font-bold mb-4">Agricultural Activities (2026)</h2>
      <div className="relative border-l-2 border-gray-200 ml-2">
        <div className="mb-6 ml-6">
          <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-500 rounded-full"></div>
          <h3 className="font-semibold">Planting</h3>
          <p className="text-sm text-gray-500">March 10, 2026</p>
          <p className="text-sm mt-1">Initial planting of corn seeds across all plots.</p>
        </div>
        <div className="mb-6 ml-6">
          <div className="absolute -left-2 top-24 w-4 h-4 bg-gray-300 rounded-full"></div>
          <h3 className="font-semibold">Fertilizing</h3>
          <p className="text-sm text-gray-500">April 15, 2026</p>
          <div className="text-sm mt-1 bg-gray-50 p-2 rounded flex items-center justify-between">
            <span>Summary: Nitrogen application...</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>
    </section>
  );
};
