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
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">加入我们</h2>
            <p className="text-sm text-zinc-500 mt-1">填写信息，申报您的数字农业基地</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">真实姓名</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="请输入您的姓名" className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-400" required />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">基地位置</label>
            <div className="flex gap-2">
              <select name="province" value={formData.province} onChange={handleChange} className="flex-1 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-zinc-700">
                <option value="省">省</option>
                <option value="浙江省">浙江省</option>
                <option value="江苏省">江苏省</option>
                <option value="广东省">广东省</option>
                <option value="其他">其他</option>
              </select>
              <select name="city" value={formData.city} onChange={handleChange} className="flex-1 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-zinc-700">
                <option value="市">市</option>
                <option value="杭州市">杭州市</option>
                <option value="南京市">南京市</option>
                <option value="广州市">广州市</option>
                <option value="其他">其他</option>
              </select>
              <select name="county" value={formData.county} onChange={handleChange} className="flex-1 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-zinc-700">
                <option value="县">县</option>
                <option value="西湖区">西湖区</option>
                <option value="玄武区">玄武区</option>
                <option value="天河区">天河区</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>
          
          <div>
            <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="镇/村及详细地址" className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-400" required />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">土地面积</label>
              <input type="number" name="area" value={formData.area} onChange={handleChange} placeholder="0.0" className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-400" required min="0" step="0.1" />
              <span className="absolute right-4 top-[38px] text-zinc-400 text-sm">亩</span>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">联系方式</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="手机号" className="w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-zinc-400" required />
            </div>
          </div>
          
          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
          
          <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2">
            {submitting ? '提交中...' : '提交申请'}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
          <p className="text-zinc-500 text-sm mb-2">或直接联系我们的客服热线</p>
          <a href="tel:400-123-4567" className="text-emerald-600 font-bold text-xl hover:text-emerald-700 transition-colors">400-123-4567</a>
        </div>
      </div>
    </div>
  );
};
