import React, { useState } from 'react';
import { X } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const JoinUsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    province: '省',
    city: '市',
    county: '县',
    address: '',
    area: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      setError('请输入有效的手机号');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      await addDoc(collection(db, 'joinRequests'), {
        ...formData,
        area: Number(formData.area),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('提交成功！我们将尽快与您联系。');
      onClose();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError('提交失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-stone-900">加入我们 / 申报基地</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-stone-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="真实姓名" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
          <div className="flex gap-2">
            <select name="province" value={formData.province} onChange={handleChange} className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm">
              <option value="省">省</option>
              <option value="浙江省">浙江省</option>
              <option value="江苏省">江苏省</option>
              <option value="广东省">广东省</option>
              <option value="其他">其他</option>
            </select>
            <select name="city" value={formData.city} onChange={handleChange} className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm">
              <option value="市">市</option>
              <option value="杭州市">杭州市</option>
              <option value="南京市">南京市</option>
              <option value="广州市">广州市</option>
              <option value="其他">其他</option>
            </select>
            <select name="county" value={formData.county} onChange={handleChange} className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm">
              <option value="县">县</option>
              <option value="西湖区">西湖区</option>
              <option value="玄武区">玄武区</option>
              <option value="天河区">天河区</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="镇/村及详细地址" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
          <div className="relative">
            <input type="number" name="area" value={formData.area} onChange={handleChange} placeholder="土地面积" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required min="0" step="0.1" />
            <span className="absolute right-3 top-3 text-stone-500 text-sm">亩（666平方米）</span>
          </div>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="联系方式 (手机号)" className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg" required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full bg-accent text-white p-3 rounded-lg font-bold shadow-md hover:opacity-90 disabled:opacity-50">
            {submitting ? '提交中...' : '提交申请'}
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-stone-100 text-center">
          <p className="text-stone-500 text-sm mb-2">直接联系我们:</p>
          <a href="tel:400-123-4567" className="text-accent font-bold text-lg">400-123-4567</a>
        </div>
      </div>
    </div>
  );
};
