import React, { useState } from 'react';
import { JoinUsModal } from './JoinUsModal';
import { UserPlus } from 'lucide-react';

export const JoinUsButton: React.FC<{ label?: string; source?: string }> = ({ label = '我要加入', source = 'join' }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white p-4 rounded-2xl font-bold text-lg shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        <UserPlus size={24} />
        {label}
      </button>
      {showModal && <JoinUsModal onClose={() => setShowModal(false)} source={source} />}
    </>
  );
};
