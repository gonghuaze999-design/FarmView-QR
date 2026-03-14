import React, { useState } from 'react';
import { X } from 'lucide-react';

export const JoinUsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的手机号');
      return;
    }
    alert('提交成功！');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-stone-900">加入我们</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="真实姓名" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
          <div className="flex gap-2">
            <select className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm"><option>省</option></select>
            <select className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm"><option>市</option></select>
            <select className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm"><option>县</option></select>
          </div>
          <input type="text" placeholder="镇/村" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
          <div className="relative">
            <input type="number" placeholder="土地面积" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
            <span className="absolute right-3 top-3 text-stone-500 text-sm">亩（666平方米）</span>
          </div>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="联系方式 (手机号)" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-accent text-white p-3 rounded-lg font-bold shadow-md hover:opacity-90">提交申请</button>
        </form>
        <div className="mt-6 pt-6 border-t border-stone-100 text-center">
          <p className="text-stone-500 text-sm mb-2">直接联系我们:</p>
          <a href="tel:400-123-4567" className="text-accent font-bold text-lg">400-123-4567</a>
        </div>
      </div>
    </div>
  );
};
