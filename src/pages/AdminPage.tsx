import React from 'react';
import { MapSection } from '../components/MapSection';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const AdminPage: React.FC = () => {
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('用户加入信息汇总', 10, 10);
    // @ts-ignore
    doc.autoTable({ head: [['姓名', '地址', '面积', '电话']], body: [['张三', '某省某市', '10', '138...']] });
    doc.save('加入信息.pdf');
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">超管后台</h1>
      <section className="farm-card p-4">
        <h2 className="text-lg font-bold mb-4">全网地块监控</h2>
        <MapSection />
      </section>
      <section className="farm-card p-4">
        <h2 className="text-lg font-bold mb-4">API 状态</h2>
        <div className="grid grid-cols-2 gap-4">
          {['生产管理平台', '物联网平台', '农业大脑', '气象数据库'].map(api => (
            <div key={api} className="p-3 bg-stone-100 rounded-lg flex justify-between">
              <span>{api}</span>
              <span className="text-green-600 font-bold">正常</span>
            </div>
          ))}
        </div>
      </section>
      <section className="farm-card p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">加入信息汇总</h2>
          <button onClick={exportPDF} className="bg-accent text-white px-4 py-2 rounded-lg text-sm">导出 PDF</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-stone-500 border-b"><tr><th className="p-2">姓名</th><th className="p-2">地址</th><th className="p-2">面积</th></tr></thead>
            <tbody><tr><td className="p-2">张三</td><td className="p-2">某村</td><td className="p-2">10</td></tr></tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
