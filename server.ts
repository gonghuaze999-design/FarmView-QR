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
      proxyReq: (proxyReq, req, res) => {
        // 直接从环境变量读取 Token
        const token = process.env.TOKEN;
        if (token) {
          proxyReq.setHeader('Authorization', `Bearer ${token}`);
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
