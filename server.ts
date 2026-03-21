import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config';
import fs from 'fs';
import Jimp from 'jimp';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 读取 sites-config.json
let sitesConfig: any = { sites: {} };
try {
  const configPath = path.join(__dirname, 'sites-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    sitesConfig = JSON.parse(raw);
    console.log(`[Config] 加载 sites-config.json，共 ${Object.keys(sitesConfig.sites).length} 个基地`);
  }
} catch (e: any) {
  console.error('[Config] 解析 sites-config.json 失败:', e.message);
}

const API_BASE = 'http://cpca.hyspi.com:54082';
const DEFAULT_SITE_KEY = 'base-current';

// ── SQLite：申报信息持久化 ──────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const joinDb = new Database(path.join(dataDir, 'join_requests.db'));
joinDb.exec(`CREATE TABLE IF NOT EXISTS join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  province TEXT,
  city TEXT,
  county TEXT,
  address TEXT,
  area REAL,
  phone TEXT NOT NULL,
  source TEXT DEFAULT 'join',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
console.log('[DB] join_requests 表已就绪');

// 按 siteKey 分别缓存 Token
const tokenCache = new Map<string, string>();

async function getTokenForSite(siteKey: string): Promise<string> {
  if (tokenCache.has(siteKey)) return tokenCache.get(siteKey)!;

  const site = sitesConfig.sites[siteKey] || sitesConfig.sites[DEFAULT_SITE_KEY];
  if (!site?.apiAuth) throw new Error(`未找到基地 ${siteKey} 的认证配置`);

  console.log(`[Auth] 正在为基地 ${siteKey} 获取 Token...`);
  const res = await axios.post(`${API_BASE}/auth/login`, {
    username: site.apiAuth.username,
    password: site.apiAuth.password,
    code: 1,
    uuid: 'farmview',
    rememberMe: true,
  });

  const token = res.data?.data?.access_token;
  if (!token) throw new Error('登录接口未返回有效 Token');

  tokenCache.set(siteKey, token);
  console.log(`[Auth] 基地 ${siteKey} Token 获取成功`);
  return token;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --- 自定义路由（必须在代理之前）---

  // 申报/加入 表单提交
  app.post('/api/join-request', (req, res) => {
    const { name, province, city, county, address, area, phone, source } = req.body;
    if (!name || !phone) return res.status(400).json({ error: '姓名和电话为必填项' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '请输入有效的手机号' });
    try {
      const stmt = joinDb.prepare(
        `INSERT INTO join_requests (name, province, city, county, address, area, phone, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const result = stmt.run(name, province, city, county, address, Number(area) || 0, phone, source || 'join');
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 管理员：获取所有申报信息
  app.get('/api/admin/join-requests', (req, res) => {
    const rows = joinDb.prepare('SELECT * FROM join_requests ORDER BY created_at DESC').all();
    res.json({ ok: true, total: rows.length, data: rows });
  });

  // 站点配置查询
  app.get('/api/site-binding', (req, res) => {
    const requestedSite = String(req.query.site || DEFAULT_SITE_KEY);
    const exists = Boolean(sitesConfig.sites[requestedSite]);
    const selected = exists ? sitesConfig.sites[requestedSite] : sitesConfig.sites[DEFAULT_SITE_KEY];

    const safeBinding = selected ? { ...selected } : null;
    if (safeBinding?.apiAuth) delete safeBinding.apiAuth;

    res.json({
      requestedSite,
      resolvedSite: exists ? requestedSite : DEFAULT_SITE_KEY,
      exists,
      fallback: !exists,
      availableSites: Object.keys(sitesConfig.sites),
      binding: safeBinding,
    });
  });

  // 诊断接口：测试登录 + 各关键接口是否通
  app.get('/api/diagnose', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: `基地 ${siteKey} 不存在` });

    const report: any = { siteKey, baseId: site.baseId, steps: [] };

    // Step 1: 登录
    let token = '';
    try {
      tokenCache.delete(siteKey); // 强制重新登录
      token = await getTokenForSite(siteKey);
      report.steps.push({ step: '登录', ok: true, token: token.substring(0, 20) + '...' });
    } catch (e: any) {
      report.steps.push({ step: '登录', ok: false, error: e.message });
      return res.json(report);
    }

    // Step 2: 测试地块列表（验证 Authorization header 格式）
    const testUrls = [
      { name: '地块列表', url: `${API_BASE}/farm/land/list?baseId=${site.baseId}`, method: 'GET' },
      { name: 'IoT设备位置', url: `${API_BASE}/collect/iot/locationList?baseId=${site.baseId}`, method: 'GET' },
    ];

    // 同时测试三种 header 格式，找出哪种有效
    const headerVariants = [
      { name: 'satoken', headers: { 'satoken': token } },
      { name: 'Authorization直接', headers: { 'Authorization': token } },
      { name: 'Authorization Bearer', headers: { 'Authorization': `Bearer ${token}` } },
    ];
    const testUrl = `${API_BASE}/farm/land/list?baseId=${site.baseId}`;
    for (const v of headerVariants) {
      try {
        const r = await axios({ method: 'GET', url: testUrl, headers: v.headers, timeout: 8000, validateStatus: () => true });
        report.steps.push({ step: `地块列表[${v.name}]`, ok: r.data?.code === 200, status: r.status, dataCode: r.data?.code, dataMsg: r.data?.msg });
      } catch (e: any) {
        report.steps.push({ step: `地块列表[${v.name}]`, ok: false, error: e.message });
      }
    }

    res.json(report);
  });

  // 测试 IoT 弹窗数据接口
  app.get('/api/test-iot', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });

    let token = '';
    try {
      token = await getTokenForSite(siteKey);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }

    const farmlandId = site.farmlandIds?.[0] || '';
    const now = new Date();
    const startTime = '2025-01-01 00:00:00';
    const endTime = '2026-12-31 00:00:00';
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const report: any = { farmlandId, results: [] };

    const tests = [
      { name: '气象实时', url: `${API_BASE}/collect/iot/getEnvRecordNow`, body: { farmlandId } },
      { name: '气象历史', url: `${API_BASE}/collect/iot/getEnvInformationNew`, body: { farmlandId, dimension: 'air_temperature,air_humidity', startTime, endTime } },
      { name: '虫情统计', url: `${API_BASE}/collect/iot/getInsectStatistics`, body: { farmlandId, startTime, endTime } },
      { name: '摄像头列表', url: `${API_BASE}/collect/collection/cameraList`, body: { baseId: site.baseId, farmlandIds: String(farmlandId) } },
    ];

    for (const t of tests) {
      try {
        const r = await axios.post(t.url, t.body, { headers, timeout: 8000, validateStatus: () => true });
        report.results.push({ name: t.name, code: r.data?.code, msg: r.data?.msg, data: r.data?.data });
      } catch (e: any) {
        report.results.push({ name: t.name, error: e.message });
      }
    }

    res.json(report);
  });

  // 探测农事行为接口路径
  app.get('/api/test-farmwork', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });

    let token = '';
    try { token = await getTokenForSite(siteKey); } catch (e: any) { return res.status(500).json({ error: e.message }); }

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const baseId = site.baseId;
    const startTime = '2023-01-01 00:00:00';
    const endTime = '2026-12-31 00:00:00';
    const report: any = { baseId, results: [] };

    const paths = [
      { name: 'taskCount', url: `${API_BASE}/farm/work/taskCount?baseId=${baseId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`, method: 'GET' },
      { name: 'list', url: `${API_BASE}/farm/work/list?baseId=${baseId}&pageNum=1&pageSize=10`, method: 'GET' },
      { name: 'page', url: `${API_BASE}/farm/work/page?baseId=${baseId}&pageNum=1&pageSize=10`, method: 'GET' },
      { name: 'queryList', url: `${API_BASE}/farm/work/queryList?baseId=${baseId}`, method: 'GET' },
      { name: 'taskList', url: `${API_BASE}/farm/work/taskList?baseId=${baseId}&pageNum=1&pageSize=10`, method: 'GET' },
      { name: 'workRecord', url: `${API_BASE}/farm/workRecord/list?baseId=${baseId}&pageNum=1&pageSize=10`, method: 'GET' },
      { name: 'farmTask', url: `${API_BASE}/farm/task/list?baseId=${baseId}&pageNum=1&pageSize=10`, method: 'GET' },
    ];

    for (const p of paths) {
      try {
        const r = await axios({ method: p.method as any, url: p.url, headers, timeout: 8000, validateStatus: () => true });
        report.results.push({ name: p.name, status: r.status, code: r.data?.code, msg: r.data?.msg, hasData: !!r.data?.data });
      } catch (e: any) {
        report.results.push({ name: p.name, error: e.message });
      }
    }
    res.json(report);
  });

  // 探测农情监测接口路径
  app.get('/api/test-ndvi', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });

    let token = '';
    try { token = await getTokenForSite(siteKey); } catch (e: any) { return res.status(500).json({ error: e.message }); }

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const baseId = site.baseId;
    const report: any = { baseId, results: [] };

    const paths = [
      { name: 'completeTaskList', url: `${API_BASE}/center/base/queryCompleteTaskList?baseId=${baseId}`, method: 'GET' },
      { name: 'growsHight', url: `${API_BASE}/center/base/growsHight`, method: 'POST', body: { dimension: 'Growth_status', farmlandId: site.farmlandIds?.[0], startTime: '2023-01-01 00:00:00', endTime: '2026-12-31 00:00:00' } },
      { name: 'droneTask', url: `${API_BASE}/center/drone/taskList?baseId=${baseId}`, method: 'GET' },
      { name: 'missionList', url: `${API_BASE}/center/mission/list?baseId=${baseId}`, method: 'GET' },
    ];

    for (const p of paths) {
      try {
        const r = await axios({ method: p.method as any, url: p.url, headers, data: (p as any).body, timeout: 10000, validateStatus: () => true });
        report.results.push({ name: p.name, status: r.status, code: r.data?.code, msg: r.data?.msg, dataType: typeof r.data?.data, dataLen: Array.isArray(r.data?.data) ? r.data.data.length : null });
      } catch (e: any) {
        report.results.push({ name: p.name, error: e.message });
      }
    }
    res.json(report);
  });

  // 查看 taskCount 和 growsHight 完整数据
  app.get('/api/test-data', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });
    let token = '';
    try { token = await getTokenForSite(siteKey); } catch (e: any) { return res.status(500).json({ error: e.message }); }
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const baseId = site.baseId;
    const farmlandId = site.farmlandIds?.[0] || '';
    const report: any = {};

    try {
      const r1 = await axios.get(`${API_BASE}/farm/work/taskCount?baseId=${baseId}&startTime=2023-01-01%2000%3A00%3A00&endTime=2026-12-31%2023%3A59%3A59`, { headers, timeout: 10000 });
      report.taskCount = r1.data;
    } catch (e: any) { report.taskCount = { error: e.message }; }

    try {
      const r2 = await axios.post(`${API_BASE}/center/base/growsHight`, { dimension: 'Growth_status', farmlandId, startTime: '2023-01-01 00:00:00', endTime: '2026-12-31 00:00:00' }, { headers, timeout: 10000 });
      report.growsHight = r2.data;
    } catch (e: any) { report.growsHight = { error: e.message }; }

    res.json(report);
  });

  // 查看农情监测图片数据
  app.get('/api/test-ndvi2', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });
    let token = '';
    try { token = await getTokenForSite(siteKey); } catch (e: any) { return res.status(500).json({ error: e.message }); }
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const report: any = {};

    // 用第一条记录的 id 和 algorithmTaskId 分别查图片
    const recordId = '2026229548268957697';
    const algorithmTaskId = '1977651420192620550';
    const tests = [
      { name: 'POST-algorithmTaskId', url: `${API_BASE}/center/base/queryPhotoAlgorithmTaskInfo?taskId=${algorithmTaskId}`, method: 'POST' },
      { name: 'POST-recordId', url: `${API_BASE}/center/base/queryPhotoAlgorithmTaskInfo?taskId=${recordId}`, method: 'POST' },
      { name: 'GET-algorithmTaskId', url: `${API_BASE}/center/base/queryPhotoAlgorithmTaskInfo?taskId=${algorithmTaskId}`, method: 'GET' },
      { name: 'GET-recordId', url: `${API_BASE}/center/base/queryPhotoAlgorithmTaskInfo?taskId=${recordId}`, method: 'GET' },
      { name: 'photoList-baseId', url: `${API_BASE}/center/base/photoList?baseId=${site.baseId}`, method: 'GET' },
      { name: 'ndviList', url: `${API_BASE}/center/base/ndviList?baseId=${site.baseId}`, method: 'GET' },
      { name: 'taskResult', url: `${API_BASE}/center/base/queryAlgorithmTaskResult?taskId=${algorithmTaskId}`, method: 'GET' },
    ];
    for (const t of tests) {
      try {
        const r = await axios({ method: t.method as any, url: t.url, headers, timeout: 8000, validateStatus: () => true });
        report[t.name] = { status: r.status, code: r.data?.code, dataLen: Array.isArray(r.data?.data) ? r.data.data.length : typeof r.data?.data, sample: Array.isArray(r.data?.data) && r.data.data.length > 0 ? r.data.data[0] : r.data?.data };
      } catch (e: any) { report[t.name] = { error: e.message }; }
    }

    res.json(report);
  });

  // ── 图像赋色（rainbow 伪彩色）──────────────────────────────────────
  // 标准流程：灰度图 → 直方图 → 众数±3σ拉伸 → rainbow 映射 → PNG base64
  function rainbowRGB(t: number): [number, number, number] {
    // blue(0) → cyan(0.25) → green(0.5) → yellow(0.75) → red(1)
    let r = 0, g = 0, b = 0;
    if (t < 0.25)      { r = 0;   g = Math.round(t * 4 * 255);           b = 255; }
    else if (t < 0.5)  { r = 0;   g = 255; b = Math.round((1 - (t - 0.25) * 4) * 255); }
    else if (t < 0.75) { r = Math.round((t - 0.5) * 4 * 255); g = 255;   b = 0; }
    else               { r = 255; g = Math.round((1 - (t - 0.75) * 4) * 255); b = 0; }
    return [r, g, b];
  }

  app.post('/api/image-colorize', async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
    try {
      // 拉取图像（支持需要 token 的内网 URL 时可在此加 headers）
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
      const buffer = Buffer.from(imgRes.data);

      const img = await Jimp.read(buffer);
      img.greyscale();
      const { data, width, height } = img.bitmap; // RGBA Uint8Array

      // 提取灰度值（取 R 通道）
      const pixels: number[] = [];
      for (let i = 0; i < data.length; i += 4) pixels.push(data[i]);

      // 直方图
      const hist = new Array(256).fill(0);
      for (const p of pixels) hist[p]++;

      // 众数
      let mode = 0, maxCount = 0;
      for (let i = 0; i < 256; i++) { if (hist[i] > maxCount) { maxCount = hist[i]; mode = i; } }

      // 均值 + 标准差
      let sum = 0;
      for (const p of pixels) sum += p;
      const mean = sum / pixels.length;
      let variance = 0;
      for (const p of pixels) variance += Math.pow(p - mean, 2);
      const std = Math.sqrt(variance / pixels.length);

      // ±3σ 拉伸范围
      const minVal = Math.max(0, Math.round(mode - 3 * std));
      const maxVal = Math.min(255, Math.round(mode + 3 * std));
      const range = maxVal - minVal || 1;

      // 逐像素赋色（输出 RGBA）
      const out = Buffer.alloc(width * height * 4);
      for (let i = 0; i < pixels.length; i++) {
        const t = Math.min(1, Math.max(0, (pixels[i] - minVal) / range));
        const [r, g, b] = rainbowRGB(t);
        out[i * 4]     = r;
        out[i * 4 + 1] = g;
        out[i * 4 + 2] = b;
        out[i * 4 + 3] = 255;
      }

      const colored = new Jimp({ data: out, width, height });
      const pngBuf = await colored.getBuffer('image/png');
      const base64 = `data:image/png;base64,${pngBuf.toString('base64')}`;
      const stats = { mode, mean: Math.round(mean), std: Math.round(std), minVal, maxVal };

      res.json({ ok: true, base64, stats, width, height });
    } catch (e: any) {
      console.error('[Colorize]', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── AI 农情分析（Gemini 2.5 Flash）──────────────────────────────────
  const aiAnalysisCache = new Map<string, any>();

  app.post('/api/ai/analyze', async (req, res) => {
    const { base64, cacheKey, context } = req.body;
    // context: { landName, cropsName, lat, lng, date, imageType, ndviStats }

    if (cacheKey && aiAnalysisCache.has(cacheKey)) {
      return res.json(aiAnalysisCache.get(cacheKey));
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY 未配置' });

    const systemPrompt = '你是一个数字农业专家，精通农业遥感技术，对卫星和无人机农情监测非常熟悉，能够快速解读农情监测图像。';
    const ctx = context || {};
    const ndviDesc = ctx.ndviStats
      ? `图像统计：均值${ctx.ndviStats.mean}，众数${ctx.ndviStats.mode}，标准差${ctx.ndviStats.std}。`
      : '';
    const userPrompt =
      `这是一张来自【${ctx.landName || '农田'}】的${ctx.imageType || '农情监测'}图像，` +
      `作物为【${ctx.cropsName || '未知'}】，` +
      (ctx.lat && ctx.lng ? `位于东经${ctx.lng}°、北纬${ctx.lat}°，` : '') +
      `采集时间为【${ctx.date || '未知'}】。${ndviDesc}` +
      `请分析：农田长势、病虫害风险、可能原因及农事建议。` +
      `正文不超过25个汉字。结尾另起一行，格式严格为：评级:优 或 评级:良 或 评级:中 或 评级:差`;

    try {
      const parts: any[] = [];
      if (base64) {
        const imgData = base64.replace(/^data:image\/\w+;base64,/, '');
        parts.push({ inlineData: { mimeType: 'image/png', data: imgData } });
      }
      parts.push({ text: userPrompt });

      const geminiRes = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
        },
        {
          headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
          timeout: 35000,
        }
      );

      const rawText: string = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const gradeMatch = rawText.match(/评级[:：]\s*(优|良|中|差)/);
      const grade = (gradeMatch?.[1] as '优' | '良' | '中' | '差') || '—';
      const text = rawText.replace(/评级[:：]\s*(优|良|中|差)/, '').trim();

      const result = { ok: true, text, grade };
      if (cacheKey) aiAnalysisCache.set(cacheKey, result);
      res.json(result);
    } catch (e: any) {
      console.error('[AI Analyze]', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Token 失效时前端可调用此接口强制刷新
  app.post('/api/refresh-token', async (req, res) => {
    const siteKey = String(req.body.site || DEFAULT_SITE_KEY);
    tokenCache.delete(siteKey);
    try {
      await getTokenForSite(siteKey);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- 代理中间件：转发所有 /api/* 到后端 ---
  app.use('/api', async (req, res) => {
    const siteKey = String(req.headers['x-site-name'] || DEFAULT_SITE_KEY);

    let token: string;
    try {
      token = await getTokenForSite(siteKey);
    } catch (e: any) {
      console.error('[Proxy] 获取 Token 失败:', e.message);
      return res.status(500).json({ error: '认证失败', detail: e.message });
    }

    // 去掉 /api 前缀，还原真实路径
    const targetPath = req.url; // express 在 app.use('/api') 下，req.url 已去掉 /api
    const targetUrl = `${API_BASE}${targetPath}`;

    console.log(`[Proxy] ${req.method} ${targetUrl}`);

    try {
      const response = await axios({
        method: req.method as any,
        url: targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
        timeout: 15000,
        validateStatus: () => true,
      });

      // token 失效时自动重新登录并重试一次（HTTP 401 或业务码 11009）
      if (response.status === 401 || response.data?.code === 11009) {
        console.warn(`[Proxy] Token 失效(${response.data?.code || response.status})，为基地 ${siteKey} 重新登录后重试`);
        tokenCache.delete(siteKey);
        token = await getTokenForSite(siteKey);
        const retry = await axios({
          method: req.method as any,
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
          timeout: 15000,
          validateStatus: () => true,
        });
        return res.status(retry.status).json(retry.data);
      }

      res.status(response.status).json(response.data);
    } catch (e: any) {
      console.error('[Proxy] 请求失败:', e.message);
      res.status(502).json({ error: '上游请求失败', detail: e.message });
    }
  });

  // --- Vite / 静态文件 ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
