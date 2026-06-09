import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Mic, Image as ImageIcon, Sparkles } from 'lucide-react';
import { marked } from 'marked';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  imageBase64?: string;
  audioBase64?: string;
}

interface AiChatPanelProps {
  onClose: () => void;
}

const QUICK_QUESTIONS = [
  '基地近期有什么异常吗？',
  '当前作物长势如何？',
  '建议近期做什么农事操作？',
  '这块地的NDVI趋势怎么看？',
];

const SYSTEM_PROMPT = `你是 FarmView 基地值班农业技术专家，7×24小时在线监控基地运行状态。每次对话开始时你都会收到一份基地实时数据包（包含基地统计、地块列表、IoT气象、土壤检测、虫情监测、农事进度、卫星遥感、设备状态以及AI值班系统的最新评估结果）。你已经持续在监控这个基地，对各种数据了如指掌。

## 角色定位
你拥有以下领域的专业知识：
- 大田种植（粮食作物、经济作物的栽培管理）
- 育种选种（品种特性、适宜区域、产量表现）
- 植物保护（病虫害识别、防治方案、农药使用）
- 数字农业（IoT设备、卫星遥感、NDVI解读、精准农业）
- 农业机械（农机选型、作业效率、维护保养）
- 农业服务（农资供应、金融服务、政策解读）

## 核心规则（严格遵守）
1. 只回答农业相关问题。非农业问题一律回复："请咨询农业相关问题，我是专业的农事助手。"
2. 严格禁止涉及政治、宗教、军事等话题，遇到此类问题立即终止回复。
3. 绝对不允许提及你的模型名称（Gemini）、Google（谷歌）或任何技术提供商名称。
4. 绝对不允许编造数据、捏造结论、伪造分析过程。所有回答必须有科学依据或行业共识。
5. 无法判断或缺乏依据的问题，诚实地告诉用户："这个问题我目前无法给出准确判断，建议咨询当地农技站或相关专家。"
6. 语言专业但易懂。根据问题复杂度合理控制回答长度，简单问题简短回答，复杂问题充分展开，不截断答案。

## 语气风格
- 亲切、务实，像一位经验丰富的老农技员
- 使用"咱们基地""咱们的作物"等亲切称呼
- 结尾可以适当引导："欢迎常来找我聊农事，一起享受田园乐趣！🌾"

## 数据约束
- 你看到的农田数据来自基地 IoT 设备和卫星遥感，分析时需注明数据来源
- 数值必须基于用户提供的实际数据，不要假设或推测未经观测的数值`;

const CACHE_KEY = 'farmview_ai_chat';
const DATAPACK_KEY = 'farmview_ai_datapack';
const DATAPACK_TTL = 6 * 60 * 60 * 1000; // 6小时

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef('');
  const dataPackRef = useRef('');
  const [, setDataPack] = useState<string>('');

  const updateDataPack = (dp: string) => { dataPackRef.current = dp; setDataPack(dp); };

  // 加载数据包 + 值班评估结果（6小时缓存）
  useEffect(() => {
    const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';
    const cached = sessionStorage.getItem(DATAPACK_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.siteKey === siteKey) {
          updateDataPack(parsed.dataPack);
          return;
        }
      } catch {}
    }
    Promise.all([
      fetch(`/api/ai/data-pack?site=${encodeURIComponent(siteKey)}`).then(r => r.json()),
      fetch(`/api/ai/notifications?site=${encodeURIComponent(siteKey)}`).then(r => r.json()),
    ]).then(([dp, notif]) => {
      let fullPack = dp.ok && dp.dataPack ? dp.dataPack : '';
      if (notif.assessment) {
        const a = notif.assessment;
        fullPack += `\n\n## 基地值班专家最新评估（${a.level === 'urgent' ? '⚠️ 紧急' : '✅ 正常'}）\n`;
        fullPack += `- 综合评级：${a.level}\n- 摘要：${a.summary}\n`;
        if (a.items) a.items.forEach((i: any) => {
          fullPack += `- [${i.level === 'urgent' ? '⚠️' : '✓'}] ${i.category}：${i.detail}\n`;
        });
      }
      if (fullPack) {
        sessionStorage.setItem(DATAPACK_KEY, JSON.stringify({ dataPack: fullPack, siteKey }));
      }
      updateDataPack(fullPack);
    }).catch(() => {});
  }, []);

  // 缓存到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(messages));
  }, [messages]);

  // 自动滚底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamText]);

  // 微信式语音录制
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const recordStartY = useRef(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          const msg: Message = { role: 'user', text: '[语音]', audioBase64: `data:audio/webm;base64,${base64}` };
          sendAudioMessage(msg);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setIsRecording(true);
      setRecordTime(0);
      recordStartY.current = 0;
      recordTimerRef.current = setInterval(() => setRecordTime(t => {
        if (t >= 59) { stopRecording(true); return 0; }
        return t + 1;
      }), 1000);
    } catch { /* permission denied */ }
  };

  const stopRecording = (autoRestart = false) => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (autoRestart) setTimeout(startRecording, 300);
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
    setRecordTime(0);
  };

  const sendAudioMessage = (msg: Message) => {
    const newMessages = [...messages, msg];
    setMessages(newMessages);
    setStreaming(true);
    setStreamText('');
    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, systemPrompt: (dataPackRef.current ? dataPackRef.current + '\n\n' : '') + SYSTEM_PROMPT }),
    }).then(async res => {
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      fullTextRef.current = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (fullTextRef.current) setMessages(prev => [...prev, { role: 'assistant', text: fullTextRef.current }]);
              setStreamText('');
              fullTextRef.current = '';
            } else {
              try {
                const token = JSON.parse(data).token;
                if (token) { fullTextRef.current += token; setStreamText(fullTextRef.current); }
              } catch {}
            }
          }
        }
      }
    }).catch(() => setStreaming(false)).finally(() => setStreaming(false));
  };

  // 图片选择
  const compressImage = async (file: File): Promise<string> => {
    const MAX_DIM = 1024;
    const QUALITY = 0.75;
    const blob = await createImageBitmap(file);
    let w = blob.width, h = blob.height;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
      else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(blob, 0, 0, w, h);
    blob.close();
    return canvas.toDataURL('image/jpeg', QUALITY);
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      setImagePreview('loading');
      const dataUrl = await compressImage(file);
      setImagePreview(dataUrl);
    } catch {
      alert('图片处理失败，请重试');
      setImagePreview(null);
    }
  };

  // 发送消息（SSE流式）
  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !imagePreview) return;
    if (streaming) return;

    const userMsg: Message = { role: 'user', text: text || '[图片]', imageBase64: imagePreview || undefined };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setImagePreview(null);
    setStreaming(true);
    setStreamText('');

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, systemPrompt: (dataPackRef.current ? dataPackRef.current + '\n\n' : '') + SYSTEM_PROMPT }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      fullTextRef.current = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const finalText = fullTextRef.current;
              if (finalText) {
                setMessages(prev => [...prev, { role: 'assistant', text: finalText }]);
              }
              setStreamText('');
              fullTextRef.current = '';
            } else {
              try {
                const { token } = JSON.parse(data);
                fullTextRef.current += token;
                setStreamText(fullTextRef.current);
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        if (fullTextRef.current) {
          setMessages(prev => [...prev, { role: 'assistant', text: fullTextRef.current }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', text: '抱歉，请求失败，请稍后重试。' }]);
        }
      }
    } finally {
      setStreamText('');
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setStreamText('');
    sessionStorage.removeItem(CACHE_KEY);
    fullTextRef.current = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="fixed inset-0 z-[160] flex flex-col justify-end">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 面板 */}
      <div
        className="relative w-full sm:max-w-md md:max-w-xl mx-auto rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#fffdf7', height: '62vh' }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0" style={{ borderColor: '#f0f0eb' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#f5f3ff' }}>
              <Sparkles size={15} className="text-purple-500" />
            </div>
            <span className="font-semibold text-sm text-zinc-800">AI 农事助手</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleNewChat} className="text-xs px-2.5 py-1 rounded-full text-purple-500 hover:bg-purple-50 transition-colors font-medium">
              新对话
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <p className="text-xs text-zinc-400 mb-3">试试问我：</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 100); }}
                    className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-purple-50 hover:border-purple-200"
                    style={{ borderColor: '#e5e7eb', color: '#6b7280', background: '#fff' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white'
                    : 'text-zinc-700'
                }`}
                style={msg.role === 'user'
                  ? { background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }
                  : { background: '#f5f3ff', border: '1px solid #ede9fe' }
                }
              >
                {msg.imageBase64 && (
                  <img src={msg.imageBase64} alt="" className="w-20 h-20 object-cover rounded-lg mb-1.5" />
                )}
                {msg.role === 'assistant'
                  ? <div className="ai-message prose-sm" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }} />
                  : msg.text
                }
              </div>
            </div>
          ))}
          {streaming && !streamText && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 flex items-center gap-1" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
                <span className="text-xs text-purple-400">思考中</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
          {streamText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm text-zinc-700" style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}>
                <div className="ai-message prose-sm" dangerouslySetInnerHTML={{ __html: marked.parse(streamText) as string }} />
                <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm align-middle" />
              </div>
            </div>
          )}
        </div>

        {/* 图片预览 */}
        {imagePreview && (
          <div className="px-4 pb-1 flex-shrink-0">
            <div className="relative inline-block">
              {imagePreview === 'loading' ? (
                <div className="w-14 h-14 rounded-xl bg-zinc-100 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-purple-500 animate-spin" />
                </div>
              ) : (
                <>
                  <img src={imagePreview} alt="preview" className="w-14 h-14 object-cover rounded-xl" />
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 输入栏 */}
        <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: '#f0f0eb' }}>
          {isRecording ? (
            <div
              className="w-full h-12 rounded-full flex items-center justify-center gap-2 text-white font-medium text-sm select-none active:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
              onTouchEnd={(e: any) => {
                const dy = e.changedTouches[0].clientY - (recordStartY.current || e.changedTouches[0].clientY);
                if (dy < -50) cancelRecording(); else stopRecording();
              }}
              onMouseUp={stopRecording}
              onMouseLeave={cancelRecording}
            >
              <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span>{String(Math.floor(recordTime / 60)).padStart(2, '0')}:{String(recordTime % 60).padStart(2, '0')}</span>
              <span className="text-xs opacity-60">松开发送 上滑取消</span>
            </div>
          ) : voiceMode ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setVoiceMode(false)} className="p-2 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors flex-shrink-0">
                <X size={20} />
              </button>
              <button
                className="flex-1 h-12 rounded-full bg-zinc-100 text-zinc-500 text-sm font-medium select-none active:bg-zinc-200 transition-colors"
                onTouchStart={(e: any) => { recordStartY.current = e.touches[0].clientY; startRecording(); }}
                onMouseDown={startRecording}
              >按住说话</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className="p-2 rounded-full text-zinc-400 hover:text-purple-500 hover:bg-purple-50 transition-colors flex-shrink-0">
                <ImageIcon size={20} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="输入问题..." className="flex-1 min-w-0 bg-zinc-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-300" />
              <button onClick={() => setVoiceMode(true)} className="p-2 rounded-full text-zinc-400 hover:text-purple-500 hover:bg-purple-50 transition-colors flex-shrink-0">
                <Mic size={20} />
              </button>
              <button onClick={sendMessage} disabled={(!input.trim() && !imagePreview) || imagePreview === 'loading'}
                className="p-2 rounded-full flex-shrink-0 disabled:opacity-30 transition-colors"
                style={{ background: (input.trim() || imagePreview) ? '#8b5cf6' : '#e5e7eb' }}>
                <Send size={18} className="text-white" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
