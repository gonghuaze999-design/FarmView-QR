import React, { useEffect, useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { RefreshCw, Download, Copy, Check, QrCode, Plus, Save, ArrowRight, ArrowLeft, ShieldCheck, MapPin } from 'lucide-react';

interface JoinRequest {
  id: number; name: string; province: string; city: string; county: string;
  address: string; area: number; phone: string; source: string; created_at: string;
}

type AdminTab = 'requests' | 'sites';

/* ================================================================
   申报审核 Tab
   ================================================================ */
const RequestsTab: React.FC = () => {
  const [rows, setRows] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/admin/join-requests').then(r => r.json()).then(d => setRows(d.data || [])).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('基地申报信息汇总', 14, 18);
    doc.setFontSize(10);
    doc.text(`导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`, 14, 26);
    (doc as any).autoTable({
      startY: 32,
      head: [['#', '提交时间', '姓名', '地址', '面积(亩)', '电话', '来源']],
      body: rows.map((r, i) => [i + 1, r.created_at?.slice(0, 16) || '', r.name, `${r.province}${r.city}${r.county}${r.address}`, r.area, r.phone, r.source === 'apply' ? '申报基地' : '加入我们']),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [245, 250, 247] },
    });
    doc.save(`基地申报_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`);
  };

  const formatRow = (r: JoinRequest) => `${r.created_at?.slice(0, 16)} | ${r.name} | ${r.province}${r.city}${r.county}${r.address} | ${r.area}亩 | ${r.phone} | ${r.source === 'apply' ? '申报基地' : '加入我们'}`;

  const copyText = () => {
    const text = [`基地申报信息汇总（共${rows.length}条，导出于${new Date().toLocaleString('zh-CN')}）`, '', ...rows.map((r, i) => `${i + 1}. ${formatRow(r)}`)].join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">共 <span className="font-bold text-zinc-800">{rows.length}</span> 条申报记录</span>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />刷新</button>
          <button onClick={copyText} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">{copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}{copied ? '已复制' : '复制'}</button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"><Download size={14} />导出PDF</button>
        </div>
      </div>
      {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 rounded-2xl animate-pulse" />)}</div>
        : rows.length === 0 ? <div className="text-center py-16 text-zinc-400 text-sm bg-zinc-50 rounded-2xl border border-zinc-100">暂无申报记录</div>
        : <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="font-semibold text-zinc-800">{r.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.source === 'apply' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{r.source === 'apply' ? '申报基地' : '加入我们'}</span>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">{r.created_at?.slice(0, 16)}</span>
              </div>
              <div className="text-sm text-zinc-600 space-y-0.5 ml-7">
                <p>📍 {r.province}{r.city}{r.county}{r.address}</p>
                <div className="flex gap-4"><span>📐 {r.area} 亩</span><a href={`tel:${r.phone}`} className="text-emerald-600 font-medium">📞 {r.phone}</a></div>
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
};

/* ================================================================
   新建基地向导
   ================================================================ */
const NewSiteWizard: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(1);
  const [siteKey, setSiteKey] = useState('');
  const [siteName, setSiteName] = useState('');
  const [owner, setOwner] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bases, setBases] = useState<any[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [lands, setLands] = useState<any[]>([]);
  const [selectedLands, setSelectedLands] = useState<Set<string>>(new Set());
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ url: string; qrReady: boolean } | null>(null);
  const qrCanvas = useRef<HTMLCanvasElement>(null);

  const doVerify = async () => {
    setVerifyStatus('loading');
    try {
      const r = await fetch('/api/admin/verify-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const d = await r.json();
      if (d.ok && d.bases?.length > 0) {
        setBases(d.bases);
        setToken(d.token);
        setVerifyStatus('ok');
        setVerifyMsg(`验证通过，找到 ${d.bases.length} 个基地`);
      } else {
        setVerifyStatus('fail');
        setVerifyMsg(d.error || '未找到基地');
      }
    } catch { setVerifyStatus('fail'); setVerifyMsg('网络错误'); }
  };

  const selectBase = async (baseId: number) => {
    setSelectedBaseId(baseId);
    setSelectedLands(new Set());
    const r = await fetch('/api/admin/get-lands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, baseId }) });
    const d = await r.json();
    if (d.ok) {
      setLands(d.lands || []);
      // 默认全选
      setSelectedLands(new Set((d.lands || []).map((l: any) => String(l.id))));
    }
  };

  const toggleLand = (id: string) => {
    const next = new Set(selectedLands);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedLands(next);
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/add-site', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey, siteName, owner,
          apiAuth: { username, password },
          baseId: selectedBaseId,
          farmlandIds: Array.from(selectedLands),
        }),
      });
      const d = await r.json();
      if (d.ok) {
        const url = `${window.location.origin}${window.location.pathname}?site=${siteKey}`;
        setResult({ url, qrReady: false });
        // 生成二维码
        setTimeout(async () => {
          const QRCode = await import('qrcode');
          if (qrCanvas.current) {
            await QRCode.toCanvas(qrCanvas.current, url, { width: 200, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' }, errorCorrectionLevel: 'H' });
            setResult({ url, qrReady: true });
          }
        }, 200);
      } else {
        alert(d.error || '保存失败');
      }
    } catch { alert('保存失败'); }
    setSaving(false);
  };

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldCheck size={28} className="text-emerald-600" /></div>
          <h3 className="text-lg font-bold text-emerald-800 mb-2">基地创建成功！</h3>
          <canvas ref={qrCanvas} className="mx-auto mb-3 rounded-xl border border-emerald-100" />
          <p className="text-sm text-emerald-700 font-medium break-all mb-1">{result.url}</p>
          <p className="text-xs text-emerald-500">首次访问自动初始化 FarmMonitor 卫星监测</p>
        </div>
        <button onClick={onDone} className="w-full py-3 bg-emerald-600 text-white font-medium rounded-2xl hover:bg-emerald-700 transition-colors">完成</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 步骤指示 */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
        {[1,2,3,4].map(s => (
          <React.Fragment key={s}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${step >= s ? 'bg-emerald-600' : 'bg-zinc-300'}`}>{s}</span>
            <span className={step >= s ? 'text-emerald-700 font-medium' : ''}>{['基本信息','对接账号','选择地块','完成'][s-1]}</span>
            {s < 4 && <span className="flex-1 h-px bg-zinc-200 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: 基本信息 */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">基地标识（URL用，英文+数字）</label>
            <input value={siteKey} onChange={e => setSiteKey(e.target.value)} placeholder="xinjiang-02" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">基地名称</label>
            <input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="河北邯郸示范基地" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">负责人</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="张总" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>
      )}

      {/* Step 2: 对接账号 */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">数字农田账号</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="用户名" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">数字农田密码</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="密码" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm focus:border-emerald-500 focus:outline-none" />
          </div>
          <button onClick={doVerify} disabled={verifyStatus === 'loading' || !username || !password}
            className="w-full py-2.5 rounded-xl font-medium text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 transition-colors">
            {verifyStatus === 'loading' ? '验证中...' : '验证连通性'}
          </button>
          {verifyMsg && <p className={`text-xs ${verifyStatus === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{verifyMsg}</p>}
        </div>
      )}

      {/* Step 3: 选择地块 */}
      {step === 3 && (
        <div className="space-y-3">
          {bases.length > 1 && (
            <div>
              <label className="text-xs text-zinc-500 block mb-1">选择基地</label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {bases.map((b: any) => (
                  <button key={b.id} onClick={() => selectBase(b.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition-colors ${selectedBaseId === b.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                    {b.name || b.shortName || `基地${b.id}`} <span className="text-zinc-400 text-xs">ID:{b.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {lands.length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 block mb-1">
                选择地块（{selectedLands.size}/{lands.length}）
                <button onClick={() => setSelectedLands(new Set(lands.map((l: any) => String(l.id))))} className="ml-2 text-emerald-600">全选</button>
                <button onClick={() => setSelectedLands(new Set())} className="ml-1 text-zinc-400">取消全选</button>
              </label>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {lands.map((l: any) => {
                  const id = String(l.id);
                  const checked = selectedLands.has(id);
                  return (
                    <button key={id} onClick={() => toggleLand(id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm border flex justify-between items-center transition-colors ${checked ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 text-zinc-500'}`}>
                      <span>{l.farmlandName || `地块${id}`}</span>
                      <span className="text-xs text-zinc-400">{Number(l.size || 0).toFixed(1)}亩</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 导航按钮 */}
      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft size={14} />上一步
          </button>
        )}
        {step < 4 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={(step === 1 && (!siteKey || !siteName)) || (step === 2 && verifyStatus !== 'ok') || (step === 3 && selectedLands.size === 0)}
            className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-zinc-300 disabled:text-zinc-500 transition-colors flex items-center justify-center gap-1">
            下一步<ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={doSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-zinc-300 transition-colors flex items-center justify-center gap-1">
            <Save size={14} />{saving ? '保存中...' : '创建基地'}
          </button>
        )}
      </div>
    </div>
  );
};

/* ================================================================
   基地管理 Tab
   ================================================================ */
const SitesTab: React.FC = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  const fetchSites = () => {
    fetch('/api/admin/sites').then(r => r.json()).then(d => setSites(d.data || [])).catch(() => {});
  };
  useEffect(() => { fetchSites(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">共 <span className="font-bold text-zinc-800">{sites.length}</span> 个基地</span>
        <button onClick={() => setShowWizard(true)}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          <Plus size={14} />新建基地
        </button>
      </div>

      {showWizard && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-zinc-800 flex items-center gap-2"><MapPin size={16} className="text-emerald-600" />新建基地</h3>
            <button onClick={() => setShowWizard(false)} className="text-xs text-zinc-400 hover:text-zinc-600">取消</button>
          </div>
          <NewSiteWizard onDone={() => { setShowWizard(false); fetchSites(); }} />
        </div>
      )}

      {sites.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm bg-zinc-50 rounded-2xl border border-zinc-100">暂无基地</div>
      ) : (
        <div className="space-y-2">
          {sites.map((s: any) => (
            <div key={s.siteKey} className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-800">{s.siteName}</span>
                  <span className="text-xs text-zinc-400 ml-2">{s.siteKey}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>🗺️ {s.landCount}块地</span>
                  <span>🌾 {s.hasFarmMonitor ? '已订阅' : '—'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ================================================================
   管理员主页
   ================================================================ */
export const AdminPage: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('requests');

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#faf9f6' }}>
      <div className="w-full max-w-2xl shadow-xl min-h-screen" style={{ background: '#fffdf7' }}>
        <div className="bg-emerald-600 px-5 py-6">
          <h1 className="text-xl font-bold text-white">管理员后台</h1>
          <p className="text-emerald-100 text-sm mt-0.5">基地管理 · 申报审核</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-zinc-100">
          {[
            { key: 'requests', label: '申报审核' },
            { key: 'sites', label: '基地管理' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as AdminTab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'requests' ? <RequestsTab /> : <SitesTab />}
        </div>
      </div>
    </div>
  );
};
