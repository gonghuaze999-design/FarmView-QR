import React, { useState, useEffect } from 'react';
import { Sprout, RefreshCw, Calendar, Tag } from 'lucide-react';
import { useSiteContext } from '../contexts/SiteContext';
import { Skeleton } from './Skeleton';

interface GrowData {
  id: string;
  date: string;
  imageUrl: string;
  tags: string[];
  summary: string;
}

export const AgriMonitoringSection: React.FC = () => {
  const { binding } = useSiteContext();
  const [data, setData] = useState<GrowData[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAgriData = async () => {
    setLoading(true);
    try {
      // 模拟调用 /center/base/growsHight 接口
      // 在实际项目中，这里会替换为真实的 fetch 调用
      // const response = await fetch(`/center/base/growsHight?farmlandId=${binding?.farmlandId}`);
      // const result = await response.json();
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 模拟返回数据
      const mockData: GrowData[] = [
        {
          id: '1',
          date: '2026-03-15',
          imageUrl: 'https://picsum.photos/seed/corn1/400/300',
          tags: ['长势良好', '无明显病害', '需水量正常'],
          summary: '当前作物处于拔节期，整体叶色浓绿，植株健壮，未见大面积病虫害发生迹象。建议保持当前水肥管理。'
        },
        {
          id: '2',
          date: '2026-03-01',
          imageUrl: 'https://picsum.photos/seed/corn2/400/300',
          tags: ['出苗整齐', '轻微缺水'],
          summary: '玉米出苗率达到95%以上，长势均匀。由于近期降水偏少，部分地块表土干燥，建议适时进行微喷灌溉。'
        }
      ];
      
      setData(mockData);
    } catch (error) {
      console.error('获取农情监测数据失败:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgriData();
  }, [binding?.farmlandId]);

  return (
    <section className="farm-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Sprout className="text-emerald-500" size={20} />
          <h2 className="text-xl font-bold text-zinc-800">农情监测</h2>
        </div>
        <button 
          onClick={fetchAgriData}
          className="text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      {loading ? (
        <div className="space-y-6 pt-2">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200/60 p-4 pt-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="flex gap-4">
                <Skeleton className="w-24 h-24 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Sprout size={24} className="text-zinc-300" />
          </div>
          <p className="text-zinc-600 font-medium mb-1">暂无农情监测数据</p>
          <p className="text-zinc-400 text-xs">当前地块暂未生成近期的遥感分析报告</p>
        </div>
      ) : (
        <div className="space-y-8 pt-2">
          {data.map((item) => (
            <div key={item.id} className="relative">
              {/* 曲别针 SVG */}
              <div className="absolute -top-4 left-6 z-10 drop-shadow-md transform -rotate-12">
                <svg width="24" height="48" viewBox="0 0 24 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 42C16.4183 42 20 38.4183 20 34V14C20 10.6863 17.3137 8 14 8C10.6863 8 8 10.6863 8 14V32C8 34.2091 9.79086 36 12 36C14.2091 36 16 34.2091 16 32V16" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 42C7.58172 42 4 38.4183 4 34V14" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* 卡片主体 */}
              <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden relative pt-2">
                {/* 顶部装饰线 */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
                
                <div className="p-4 pt-5">
                  <div className="flex items-center gap-1.5 mb-3 text-zinc-500">
                    <Calendar size={14} />
                    <span className="text-xs font-medium font-mono">{item.date}</span>
                  </div>
                  
                  <div className="flex gap-4">
                    {/* 左侧缩略图 */}
                    <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-zinc-100 shadow-sm relative group">
                      <img 
                        src={item.imageUrl} 
                        alt="农情影像" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                    </div>
                    
                    {/* 右侧分析结论 */}
                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {item.tags.map((tag, idx) => (
                          <span 
                            key={idx} 
                            className={`text-[10px] px-2 py-1 rounded-md font-medium flex items-center gap-1
                              ${idx === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                                idx === 1 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                                'bg-zinc-50 text-zinc-600 border border-zinc-200'}`}
                          >
                            <Tag size={10} />
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3">
                        {item.summary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
