import React, { useState } from 'react';
import { JoinUsModal } from './JoinUsModal';
import { UserPlus } from 'lucide-react';

export const JoinUsButton: React.FC<{ label?: string }> = ({ label = '我要加入' }) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full bg-accent hover:bg-green-700 text-white p-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
      >
        <UserPlus size={24} />
        {label}
      </button>
      {showModal && <JoinUsModal onClose={() => setShowModal(false)} />}
    </>
  );
};
