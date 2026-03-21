import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
// @ts-ignore
import chinaAreaData from 'china-area-data';

type Region = { value: string; label: string; children?: Region[] };

const sel = 'w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-zinc-800 disabled:text-zinc-300 disabled:cursor-not-allowed';
const inp = 'w-full p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none placeholder:text-zinc-400';

export const JoinUsModal: React.FC<{ onClose: () => void; source?: string }> = ({ onClose, source = 'join' }) => {
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const provinces: Region[] = Array.isArray(chinaAreaData?.regionData) ? chinaAreaData.regionData : (chinaAreaData?.default?.regionData || []);
  const cities = useMemo(() => provinces.find(p => p.label === province)?.children || [], [province]);
  const counties = useMemo(() => cities.find(c => c.label === city)?.children || [], [city]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProvince(e.target.value);
    setCity('');
    setCounty('');
  };
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value);
    setCounty('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入有效的手机号'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, province, city, county, address, area: Number(area) || 0, phone, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setDone(true);
    } catch (err: any) {
      setError(err.message || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">加入我们</h2>
            <p className="text-sm text-zinc-500 mt-1">填写信息，申报您的数字农业基地</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {done ? (
          <div className="py-10 text-center space-y-3">
            <div className="text-5xl">🌱</div>
            <p className="text-lg font-bold text-zinc-800">提交成功！</p>
            <p className="text-sm text-zinc-500">我们将尽快与您联系，感谢您的关注。</p>
            <button onClick={onClose} className="mt-4 px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold">关闭</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">真实姓名</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="请输入您的姓名" className={inp} required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">基地位置</label>
              <div className="space-y-2">
                <select value={province} onChange={handleProvinceChange} className={sel} required>
                  <option value="">请选择省 / 直辖市 / 自治区</option>
                  {provinces.map(p => <option key={p.value} value={p.label}>{p.label}</option>)}
                </select>
                <select value={city} onChange={handleCityChange} disabled={!province} className={sel} required>
                  <option value="">请选择市</option>
                  {cities.map(c => <option key={c.value} value={c.label}>{c.label}</option>)}
                </select>
                <select value={county} onChange={e => setCounty(e.target.value)} disabled={!city} className={sel}>
                  <option value="">请选择县 / 区（可选）</option>
                  {counties.map(d => <option key={d.value} value={d.label}>{d.label}</option>)}
                </select>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="镇 / 村及详细地址" className={inp} required />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">土地面积</label>
                <input type="number" value={area} onChange={e => setArea(e.target.value)}
                  placeholder="0.0" min="0" step="0.1" className={inp} required />
                <span className="absolute right-4 top-[38px] text-zinc-400 text-sm">亩</span>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">联系电话</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="手机号" className={inp} required />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}

            <button type="submit" disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50">
              {submitting ? '提交中...' : '提交申请'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-zinc-100 text-center">
          <p className="text-zinc-500 text-sm mb-1">或直接联系我们</p>
          <a href="tel:18010100298" className="text-emerald-600 font-bold text-xl hover:text-emerald-700 transition-colors">
            18010100298
          </a>
        </div>
      </div>
    </div>
  );
};
