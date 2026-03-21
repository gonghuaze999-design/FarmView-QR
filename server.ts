import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config';
import fs from 'fs';

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

    // 用第一条 algorithmTaskId 查图片
    const taskId = '1977651420192620550';
    try {
      const r1 = await axios.post(`${API_BASE}/center/base/queryPhotoAlgorithmTaskInfo?taskId=${taskId}`, {}, { headers, timeout: 10000 });
      report.photoInfo = r1.data;
    } catch (e: any) { report.photoInfo = { error: e.message }; }

    // 也试试 GET 方式
    try {
      const r2 = await axios.get(`${API_BASE}/center/base/queryPhotoAlgorithmTaskInfo?taskId=${taskId}`, { headers, timeout: 10000, validateStatus: () => true });
      report.photoInfoGet = { status: r2.status, code: r2.data?.code, data: r2.data?.data };
    } catch (e: any) { report.photoInfoGet = { error: e.message }; }

    res.json(report);
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
