import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. 读取 sites-config.json
let sitesConfig: any = { sites: {} };
try {
  const configPath = path.join(__dirname, 'sites-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    sitesConfig = JSON.parse(raw);
    console.log(`[Config] 成功加载 sites-config.json，包含 ${Object.keys(sitesConfig.sites).length} 个基地配置。`);
  } else {
    console.warn('[Config] 未找到 sites-config.json，将使用空配置。');
  }
} catch (e: any) {
  console.error('[Config] 解析 sites-config.json 失败:', e.message);
}

const DEFAULT_SITE_KEY = 'base-current';

// 动态 Token 缓存
let cachedToken: string | null = null;

async function getValidToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const site = sitesConfig.sites[DEFAULT_SITE_KEY];
  if (!site || !site.apiAuth) {
    throw new Error('未找到默认基地的认证配置');
  }

  try {
    console.log('[Auth] 正在获取新 Token...');
    const res = await axios.post('http://cpca.hyspi.com:54082/auth/login', {
      username: site.apiAuth.username,
      password: site.apiAuth.password,
    });
    
    if (res.data && res.data.data && res.data.data.access_token) {
      cachedToken = res.data.data.access_token;
      console.log('[Auth] Token 获取成功');
      return cachedToken!;
    } else {
      throw new Error('登录接口未返回有效 Token');
    }
  } catch (e: any) {
    console.error('[Auth] 登录失败:', e.message);
    throw e;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 提供站点配置接口给前端
  app.get('/api/site-binding', (req, res) => {
    const requestedSite = String(req.query.site || DEFAULT_SITE_KEY);
    const exists = Boolean(sitesConfig.sites[requestedSite]);
    const selected = exists ? sitesConfig.sites[requestedSite] : sitesConfig.sites[DEFAULT_SITE_KEY];
    const fallback = !exists;

    // 移除敏感的账号密码信息后再下发给前端
    const safeBinding = selected ? { ...selected } : null;
    if (safeBinding && safeBinding.apiAuth) {
      delete safeBinding.apiAuth;
    }

    res.json({
      requestedSite,
      resolvedSite: fallback ? DEFAULT_SITE_KEY : requestedSite,
      exists,
      fallback,
      availableSites: Object.keys(sitesConfig.sites),
      binding: safeBinding,
    });
  });

  // 统一代理到麦芒/大数据平台
  app.use('/api/cpca', createProxyMiddleware({
    target: 'http://cpca.hyspi.com:54082',
    changeOrigin: true,
    pathRewrite: { '^/api/cpca': '' },
    on: {
      proxyReq: async (proxyReq, req, res) => {
        try {
          const token = await getValidToken();
          proxyReq.setHeader('Authorization', `Bearer ${token}`);
        } catch (e) {
          console.error('[Proxy] 无法注入 Token:', e);
        }
      },
      proxyRes: (proxyRes, req, res) => {
        // 如果后端返回 11009，说明 Token 失效，清除缓存
        if (proxyRes.statusCode === 200) {
            // 注意：有些 API 即使认证失败也返回 200，需要检查响应体
            // 这里简单处理，如果后续发现认证失败，可以在这里进一步解析响应体
        }
        if (proxyRes.statusCode === 401) {
            cachedToken = null;
        }
      }
    }
  }));

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    console.log(`[Static] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
