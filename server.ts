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
        params: req.method === 'GET' ? undefined : undefined, // query string 已在 targetPath 中
        timeout: 15000,
        validateStatus: () => true, // 不抛出 HTTP 错误，原样透传
      });

      // 如果 token 过期，清除缓存并重试一次
      if (response.status === 401) {
        console.warn(`[Proxy] Token 过期，为基地 ${siteKey} 刷新后重试`);
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
