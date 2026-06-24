import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw, Download, Copy, Check, QrCode, Plus, Save, ArrowRight, ArrowLeft, ShieldCheck, MapPin, Trash2, X } from 'lucide-react';

interface JoinRequest {
  id: number; name: string; province: string; city: string; county: string;
  address: string; area: number; phone: string; source: string; created_at: string;
}

type AdminTab = 'requests' | 'sites' | 'assessments';

/* ================================================================
   申报审核 Tab
   ================================================================ */
const RequestsTab: React.FC = () => {
  const [rows, setRows] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/admin/join-requests').then(r => r.json()).then(d => setRows(d.data || [])).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/join-requests/${id}`, { method: 'DELETE' });
    setDeleteId(null);
    fetchData();
  };

  const exportCSV = () => {
    const header = ['序号', '提交时间', '姓名', '省份', '城市', '区县', '详细地址', '面积(亩)', '电话', '来源'];
    const body = rows.map((r, i) => [
      i + 1,
      r.created_at || '',
      r.name,
      r.province,
      r.city,
      r.county,
      r.address,
      r.area,
      r.phone,
      r.source === 'apply' ? '申报基地' : '加入我们',
    ]);
    const csvContent = [header, ...body].map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const BOM = '﻿';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `基地申报_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"><Download size={14} />导出CSV</button>
        </div>
      </div>
      {loading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 rounded-2xl animate-pulse" />)}</div>
        : rows.length === 0 ? <div className="text-center py-16 text-zinc-400 text-sm bg-zinc-50 rounded-2xl border border-zinc-100">暂无申报记录</div>
        : <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
              {deleteId === r.id && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setDeleteId(null)}>
                  <div className="bg-white rounded-2xl p-6 mx-4 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
                    <p className="text-sm font-medium text-zinc-800 mb-1">确认删除</p>
                    <p className="text-xs text-zinc-500 mb-4">删除 {r.name} 的申报记录？此操作不可撤销。</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteId(null)} className="flex-1 py-2 rounded-xl bg-zinc-100 text-zinc-600 text-sm">取消</button>
                      <button onClick={() => handleDelete(r.id)} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm">删除</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="font-semibold text-zinc-800">{r.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.source === 'apply' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>{r.source === 'apply' ? '申报基地' : '加入我们'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 shrink-0">{r.created_at?.slice(0, 16)}</span>
                  <button onClick={() => setDeleteId(r.id)} className="p-1 text-zinc-400 hover:text-red-500 transition-colors" title="删除"><Trash2 size={14} /></button>
                </div>
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

  // 只有一个基地时自动加载地块列表
  useEffect(() => {
    if (bases.length === 1) {
      selectBase(bases[0].id);
    }
  }, [bases]);

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
  const [deleteTarget, setDeleteTarget] = useState<{ siteKey: string; siteName: string; hasFarmMonitor: boolean; fmFieldCount: number } | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'farmMonitor' | null>(null);
  const [cleanupFM, setCleanupFM] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSites = () => {
    fetch('/api/admin/sites').then(r => r.json()).then(d => setSites(d.data || [])).catch(() => {});
  };
  useEffect(() => { fetchSites(); }, []);

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const r = await fetch('/api/admin/delete-site', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey: deleteTarget.siteKey, cleanupFarmMonitor: cleanupFM }),
      });
      const d = await r.json();
      if (d.ok) {
        setDeleteTarget(null);
        setDeleteStep(null);
        setCleanupFM(false);
        fetchSites();
      } else {
        alert(d.error || '删除失败');
      }
    } catch { alert('网络错误'); }
    setDeleting(false);
  };

  const handleDeleteClick = (s: any) => {
    setDeleteTarget({ siteKey: s.siteKey, siteName: s.siteName, hasFarmMonitor: s.hasFarmMonitor, fmFieldCount: s.fmFieldCount });
    setDeleteStep('confirm');
    setCleanupFM(false);
  };

  const handleFirstConfirm = () => {
    if (deleteTarget?.hasFarmMonitor) {
      setDeleteStep('farmMonitor');
    } else {
      doDelete();
    }
  };

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

      {/* Step 1: 确认删除本系统基地 */}
      {deleteTarget && deleteStep === 'confirm' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setDeleteTarget(null); setDeleteStep(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <Trash2 size={20} />
              <h3 className="text-lg font-bold">确认删除</h3>
            </div>
            <p className="text-sm text-zinc-600 mb-2">
              确定要删除基地 <span className="font-bold text-zinc-800">「{deleteTarget.siteName}」</span> 吗？
            </p>
            <p className="text-xs text-red-500 mb-5 bg-red-50 rounded-xl p-3 border border-red-100">
              此操作将清除该基地在本系统的所有配置和数据。
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteStep(null); }}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">取消</button>
              <button onClick={handleFirstConfirm}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-600 text-white hover:bg-red-700 transition-colors">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 是否同步取消麦吉看田 */}
      {deleteTarget && deleteStep === 'farmMonitor' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { doDelete(); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3 text-amber-600">
              <ShieldCheck size={20} />
              <h3 className="text-lg font-bold">同步取消麦吉看田？</h3>
            </div>
            <p className="text-sm text-zinc-600 mb-2">
              基地「{deleteTarget.siteName}」已关联 <span className="font-bold text-amber-700">麦吉看田卫星监测</span>（{deleteTarget.fmFieldCount} 个地块）。
            </p>
            <p className="text-xs text-zinc-500 mb-3 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
              即使不取消，麦吉看田账号仍可独立登录使用。大多数情况下建议同步取消，避免产生不必要的服务费用。
            </p>
            <label className="flex items-center gap-2 mb-5 cursor-pointer">
              <input type="checkbox" checked={cleanupFM} onChange={e => setCleanupFM(e.target.checked)} className="w-4 h-4 rounded accent-red-600" />
              <span className="text-sm text-zinc-700">同步取消麦吉看田的农场及订阅服务</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => doDelete()}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
                仅删除本系统
              </button>
              <button onClick={() => { setCleanupFM(true); doDelete(); }} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-600 text-white hover:bg-red-700 disabled:bg-zinc-300 transition-colors">
                {deleting ? '删除中...' : '同步删除全部'}
              </button>
            </div>
          </div>
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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">🗺️ {s.landCount}块地</span>
                  <span className="text-xs text-zinc-500">🌾 {s.hasFarmMonitor ? '已订阅' : '—'}</span>
                  <button
                    onClick={() => handleDeleteClick(s)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除基地"
                  >
                    <Trash2 size={15} />
                  </button>
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
/* ================================================================
   基地评估汇总 Tab
   ================================================================ */
const AssessmentsTab: React.FC = () => {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [assessing, setAssessing] = useState<Set<string>>(new Set());

  const fetchSites = () => {
    setLoading(true);
    fetch('/api/admin/assessments').then(r => r.json()).then(d => setSites(d.sites || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchSites(); }, []);

  const fetchHistory = (siteKey: string) => {
    fetch(`/api/admin/assessments/${siteKey}`).then(r => r.json()).then(setHistory).catch(() => {});
  };

  const triggerAssess = async (siteKey: string) => {
    setAssessing(prev => new Set(prev).add(siteKey));
    await fetch('/api/admin/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site: siteKey }) });
    setAssessing(prev => { const s = new Set(prev); s.delete(siteKey); return s; });
    fetchSites();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-500">共 <span className="font-bold text-zinc-800">{sites.length}</span> 个基地</span>
        <button onClick={fetchSites} className="p-2 rounded-full hover:bg-zinc-100"><RefreshCw size={16} className={loading ? 'animate-spin text-emerald-500' : 'text-zinc-400'} /></button>
      </div>
      {loading ? <div className="text-center py-8 text-zinc-400 text-sm">加载中...</div> : sites.length === 0 ? <div className="text-center py-8 text-zinc-400 text-sm">暂无评估数据</div> : (
        <div className="space-y-3">
          {sites.map(s => (
            <div key={s.siteKey}>
              <div className={`rounded-2xl border overflow-hidden transition-shadow ${assessing.has(s.siteKey) ? 'ring-2 ring-emerald-300 shadow-lg' : ''} ${s.level === 'urgent' ? 'border-red-200 bg-red-50/50' : s.level === 'error' ? 'border-amber-200 bg-amber-50/50' : 'border-zinc-100 bg-white'}`}>
                <div className="px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => { if (expanded === s.siteKey) setExpanded(null); else { setExpanded(s.siteKey); fetchHistory(s.siteKey); } }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.level === 'urgent' ? 'bg-red-500' : s.level === 'error' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-800 truncate">{s.siteName}</h3>
                      <p className="text-xs text-zinc-500 truncate">{s.summary || '(无摘要)'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-zinc-400">{s.time?.slice(0, 16) || ''}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.level === 'urgent' ? 'bg-red-100 text-red-600' : s.level === 'error' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>{s.level === 'urgent' ? '紧急' : s.level === 'error' ? '失败' : '正常'}</span>
                  </div>
                </div>
                {s.items?.length > 0 && (
                  <div className="px-4 pb-2 grid grid-cols-2 gap-1">
                    {s.items.slice(0, 6).map((it: any, i: number) => (
                      <span key={i} className="text-[10px] text-zinc-600 truncate">{it.level === 'urgent' ? '⚠️' : '✓'} {it.category}: {it.detail}</span>
                    ))}
                  </div>
                )}
              </div>
              {expanded === s.siteKey && (
                <div className="mt-1 ml-4 pl-4 border-l-2 border-zinc-100 space-y-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-medium">历史记录（最近30条）</span>
                    <button onClick={() => triggerAssess(s.siteKey)} disabled={assessing.has(s.siteKey)}
                      className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${assessing.has(s.siteKey) ? 'bg-emerald-100 text-emerald-400' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}>
                      {assessing.has(s.siteKey) ? '评估中...' : '立即评估'}
                    </button>
                  </div>
                  {history.length === 0 ? <div className="text-xs text-zinc-400">加载中...</div> : history.map((h: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.level === 'urgent' ? 'bg-red-400' : h.level === 'error' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span className="text-[10px] text-zinc-400 w-28 flex-shrink-0">{h.time?.slice(0, 16)}</span>
                      <span className="text-xs text-zinc-600 truncate">{h.summary}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

  const [tab, setTab] = useState<AdminTab>('requests');

  return (
    <div className="min-h-screen flex justify-center" style={{ background: '#faf9f6' }}>
      <div className="w-full max-w-2xl shadow-xl min-h-screen" style={{ background: '#fffdf7' }}>
        <div className="bg-emerald-600 px-5 py-6">
          <h1 className="text-xl font-bold text-white">管理员后台</h1>
          <p className="text-emerald-100 text-sm mt-0.5">基地管理 · 申报审核 · 评估汇总</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-zinc-100">
          {[
            { key: 'requests', label: '申报审核' },
            { key: 'sites', label: '基地管理' },
            { key: 'assessments', label: '评估汇总' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as AdminTab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'requests' ? <RequestsTab /> : tab === 'sites' ? <SitesTab /> : <AssessmentsTab />}
        </div>
      </div>
    </div>
  );
};
