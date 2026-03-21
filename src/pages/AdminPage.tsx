import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { RefreshCw, Download, Copy, Check } from 'lucide-react';

interface JoinRequest {
  id: number;
  name: string;
  province: string;
  city: string;
  county: string;
  address: string;
  area: number;
  phone: string;
  source: string;
  created_at: string;
}

export const AdminPage: React.FC = () => {
  const [rows, setRows] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/admin/join-requests')
      .then(r => r.json())
      .then(d => setRows(d.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const formatRow = (r: JoinRequest) =>
    `${r.created_at?.slice(0, 16)} | ${r.name} | ${r.province}${r.city}${r.county}${r.address} | ${r.area}亩 | ${r.phone} | 来源:${r.source === 'apply' ? '申报基地' : '加入我们'}`;

  const exportPDF = () => {
    const doc = new jsPDF();
    // 标题
    doc.setFontSize(16);
    doc.text('基地申报信息汇总', 14, 18);
    doc.setFontSize(10);
    doc.text(`导出时间：${new Date().toLocaleString('zh-CN')}  共 ${rows.length} 条`, 14, 26);
    // @ts-ignore
    doc.autoTable({
      startY: 32,
      head: [['#', '提交时间', '姓名', '地址', '面积(亩)', '电话', '来源']],
      body: rows.map((r, i) => [
        i + 1,
        r.created_at?.slice(0, 16) || '',
        r.name,
        `${r.province}${r.city}${r.county}${r.address}`,
        r.area,
        r.phone,
        r.source === 'apply' ? '申报基地' : '加入我们',
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [245, 250, 247] },
    });
    doc.save(`基地申报_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.pdf`);
  };

  const copyText = () => {
    const text = [
      `基地申报信息汇总（共${rows.length}条，导出于${new Date().toLocaleString('zh-CN')}）`,
      '',
      ...rows.map((r, i) => `${i + 1}. ${formatRow(r)}`),
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex justify-center">
      <div className="w-full max-w-2xl bg-white shadow-xl min-h-screen">
        {/* Header */}
        <div className="bg-emerald-600 px-5 py-6">
          <h1 className="text-xl font-bold text-white">超级管理员后台</h1>
          <p className="text-emerald-100 text-sm mt-0.5">基地申报信息管理</p>
        </div>

        <div className="p-5 space-y-4">
          {/* 操作栏 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              共 <span className="font-bold text-zinc-800">{rows.length}</span> 条申报记录
            </span>
            <div className="flex gap-2">
              <button onClick={fetchData}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                刷新
              </button>
              <button onClick={copyText}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copied ? '已复制' : '复制文本'}
              </button>
              <button onClick={exportPDF}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                <Download size={14} />
                导出 PDF
              </button>
            </div>
          </div>

          {/* 列表 */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-sm bg-zinc-50 rounded-2xl border border-zinc-100">
              暂无申报记录
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={r.id} className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="font-semibold text-zinc-800">{r.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.source === 'apply' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {r.source === 'apply' ? '申报基地' : '加入我们'}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">{r.created_at?.slice(0, 16)}</span>
                  </div>
                  <div className="text-sm text-zinc-600 space-y-0.5 ml-7">
                    <p>📍 {r.province}{r.city}{r.county}{r.address}</p>
                    <div className="flex gap-4">
                      <span>📐 {r.area} 亩</span>
                      <a href={`tel:${r.phone}`} className="text-emerald-600 font-medium">📞 {r.phone}</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-zinc-400 text-center pt-2">
            访问地址：/admin · 导出 PDF 后可通过微信发送给相关人员
          </p>
        </div>
      </div>
    </div>
  );
};
