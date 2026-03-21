import React, { useState, useMemo } from 'react';
import { X, ChevronDown } from 'lucide-react';
// @ts-ignore
import { regionData } from 'china-area-data';

type Region = { value: string; label: string; children?: Region[] };

const fieldBase = 'w-full px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-base outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15';
const inputCls = `${fieldBase} placeholder:text-zinc-400 text-zinc-800`;
const selectCls = `${fieldBase} appearance-none text-zinc-800 disabled:text-zinc-400 disabled:bg-zinc-100 disabled:cursor-not-allowed`;
const labelCls = 'block text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5';

const SelectWrap: React.FC<{ children: React.ReactNode; disabled?: boolean }> = ({ children, disabled }) => (
  <div className="relative">
    {children}
    <ChevronDown size={15} className={`absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${disabled ? 'text-zinc-300' : 'text-zinc-400'}`} />
  </div>
);

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

  const provinces: Region[] = Array.isArray(regionData) ? regionData : [];
  const cities = useMemo(() => provinces.find(p => p.label === province)?.children || [], [province]);
  const counties = useMemo(() => cities.find(c => c.label === city)?.children || [], [city]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProvince(e.target.value); setCity(''); setCounty('');
  };
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value); setCounty('');
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
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">申报数字农业基地</h2>
            <p className="text-xs text-zinc-400 mt-0.5">填写信息后我们将尽快与您联系</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 表单区域可滚动 */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {done ? (
            <div className="py-12 text-center space-y-3">
              <div className="text-6xl mb-2">🌱</div>
              <p className="text-lg font-bold text-zinc-800">提交成功！</p>
              <p className="text-sm text-zinc-500 leading-relaxed">我们将在 1-2 个工作日内与您联系<br />感谢您对数字农业的支持</p>
              <button onClick={onClose} className="mt-6 px-10 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors">关闭</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* 姓名 */}
              <div>
                <label className={labelCls}>联系人姓名</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="请输入真实姓名" className={inputCls} required />
              </div>

              {/* 省市县 */}
              <div>
                <label className={labelCls}>基地所在地区</label>
                <div className="space-y-2">
                  <SelectWrap>
                    <select value={province} onChange={handleProvinceChange} className={selectCls} required>
                      <option value="">选择省 / 直辖市 / 自治区</option>
                      {provinces.map(p => <option key={p.value} value={p.label}>{p.label}</option>)}
                    </select>
                  </SelectWrap>
                  <SelectWrap disabled={!province}>
                    <select value={city} onChange={handleCityChange} disabled={!province} className={selectCls} required>
                      <option value="">{province ? '选择市' : '请先选择省份'}</option>
                      {cities.map(c => <option key={c.value} value={c.label}>{c.label}</option>)}
                    </select>
                  </SelectWrap>
                  <SelectWrap disabled={!city}>
                    <select value={county} onChange={e => setCounty(e.target.value)} disabled={!city} className={selectCls}>
                      <option value="">{city ? '选择县 / 区（可选）' : '请先选择市'}</option>
                      {counties.map(d => <option key={d.value} value={d.label}>{d.label}</option>)}
                    </select>
                  </SelectWrap>
                </div>
              </div>

              {/* 详细地址 */}
              <div>
                <label className={labelCls}>详细地址</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="镇 / 村及具体地点" className={inputCls} required />
              </div>

              {/* 面积 + 电话 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>土地面积</label>
                  <div className="relative">
                    <input type="number" value={area} onChange={e => setArea(e.target.value)}
                      placeholder="0.0" min="0" step="0.1" className={`${inputCls} pr-8`} required />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-medium">亩</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>联系电话</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="手机号" className={inputCls} required />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}

              <button type="submit" disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50">
                {submitting ? '提交中...' : '提交申请'}
              </button>

              {/* 联系电话 */}
              <div className="text-center pt-1 pb-2">
                <p className="text-xs text-zinc-400 mb-1.5">或直接致电咨询</p>
                <a href="tel:18010100298" className="text-emerald-600 font-bold text-lg hover:text-emerald-700 transition-colors">
                  180-1010-0298
                </a>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
};
