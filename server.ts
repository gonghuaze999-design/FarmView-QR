import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOIRE_BASE_URL = 'https://api.hoire.cn';

type SiteDeviceBinding = {
  siteName: string;
  weatherId: number;
  insectId: number;
  cameraId: number;
  farmlandId?: number;
  center?: [number, number];
  polygon?: [number, number][];
};

const SITE_DEVICE_BINDINGS: Record<string, SiteDeviceBinding> = {
  'base-current': {
    siteName: 'A区 种植地',
    weatherId: 11828,
    insectId: 2734,
    cameraId: 313793,
    farmlandId: 12,
    center: [116.397428, 39.90923],
    polygon: [
      [116.396, 39.908],
      [116.399, 39.908],
      [116.399, 39.910],
      [116.396, 39.910]
    ]
  },
};

const DEFAULT_SITE_KEY = 'base-current';

function loadSiteBindingsFromEnv() {
  const raw = process.env.SITE_DEVICE_BINDINGS_JSON;
  if (!raw) return SITE_DEVICE_BINDINGS;

  try {
    const parsed = JSON.parse(raw) as Record<string, SiteDeviceBinding>;
    const keys = Object.keys(parsed || {});
    if (keys.length === 0) {
      console.warn('[SiteBinding] SITE_DEVICE_BINDINGS_JSON 为空对象，回退默认绑定。');
      return SITE_DEVICE_BINDINGS;
    }

    console.log(`[SiteBinding] 已从环境变量加载 ${keys.length} 个基地绑定。`);
    return parsed;
  } catch (error: any) {
    console.warn('[SiteBinding] SITE_DEVICE_BINDINGS_JSON 解析失败，回退默认绑定:', error.message);
    return SITE_DEVICE_BINDINGS;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const APP_URL = process.env.APP_URL?.replace(/\/$/, '');
  const siteBindings = loadSiteBindingsFromEnv();

  if (!APP_URL) {
    throw new Error('APP_URL 未配置，无法生成 Hoire 回调地址。请在环境变量中设置 APP_URL，例如: https://farm-api.example.com');
  }

  const isValidHttpUrl = /^https?:\/\//.test(APP_URL);
  if (!isValidHttpUrl) {
    throw new Error(`APP_URL 格式不合法: ${APP_URL}。必须以 http:// 或 https:// 开头。`);
  }

  // 内存存储最新数据和订阅结果
  let latestIotData: Record<string, any[]> = {};
  let lastSubscriptionResult: any = null;

  // API routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // 真实推送接口
  app.post("/api/iot/receive", (req, res) => {
    console.log("[IOT Push] 收到物联网平台推送请求", {
      ip: req.ip,
      ua: req.headers['user-agent'],
      time: new Date().toISOString(),
    });
    
    // 尝试从 payload 中提取设备 ID
    const deviceId = req.body?.id || req.body?.device_id || req.body?.deviceId || 'unknown';
    
    if (!latestIotData[deviceId]) {
      latestIotData[deviceId] = [];
    }
    
    // 将新数据插入到数组开头，并保留最多 5 条历史记录
    latestIotData[deviceId].unshift({
      receiveTime: new Date().toISOString(),
      payload: req.body
    });
    
    if (latestIotData[deviceId].length > 5) {
      latestIotData[deviceId].pop();
    }

    res.status(200).json({ code: 0, message: "接收成功" });
  });

  app.get('/api/iot/ping', (req, res) => {
    res.status(200).json({
      ok: true,
      message: 'IoT callback endpoint is reachable',
      callbackUrl: `${APP_URL}/api/iot/receive`,
      time: new Date().toISOString(),
    });
  });

  // 新增：获取所有设备的原始推送数据
  app.get("/api/iot/raw-data", (req, res) => {
    res.status(200).json(latestIotData);
  });

  let cachedToken: string | null = null;
  let tokenExpiration: number = 0;

  // --- CPCA Token Polling ---
  let cpcaToken: string | null = null;
  let cpcaTokenExpiry: number = 0;

  async function refreshCpcaToken() {
    try {
      console.log('[CPCA Auth] 正在获取最新 Token...');
      const res = await axios.post('http://cpca.hyspi.com:54082/auth/login', {
        username: 'admin',
        password: 'admin123',
        code: 1,
        uuid: '6c738ec15326456abcb431c37dfcb0e2',
        rememberMe: true
      });
      if (res.data && res.data.data && res.data.data.access_token) {
        cpcaToken = res.data.data.access_token;
        cpcaTokenExpiry = Date.now() + 1000 * 60 * 60 * 2; // 假设 2 小时过期
        console.log('[CPCA Auth] Token 获取成功');
      } else {
        console.error('[CPCA Auth] Token 获取失败, 响应异常:', res.data);
      }
    } catch (error: any) {
      console.error('[CPCA Auth] Token 请求失败:', error.message);
    }
  }

  // 初始获取
  await refreshCpcaToken();
  
  // 定时刷新 (每小时)
  setInterval(refreshCpcaToken, 1000 * 60 * 60);

  // 统一代理到麦芒/大数据平台
  app.use('/api/cpca', createProxyMiddleware({
    target: 'http://cpca.hyspi.com:54082',
    changeOrigin: true,
    pathRewrite: { '^/api/cpca': '' },
    on: {
      proxyReq: (proxyReq, req, res) => {
        if (cpcaToken) {
          proxyReq.setHeader('Authorization', `Bearer ${cpcaToken}`);
        }
      }
    }
  }));
  // --------------------------

  async function getValidToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && tokenExpiration > now + 300) {
      return cachedToken;
    }
    const account = process.env.HOIRE_ACCOUNT;
    const password = process.env.HOIRE_PASSWORD;
    if (!account || !password) {
      throw new Error("HOIRE_ACCOUNT or HOIRE_PASSWORD is not set in environment variables");
    }
    console.log(`[Token] 请求新 Token: ${HOIRE_BASE_URL}/open/token/get, 账号: ${account}`);
    const response = await axios.post(`${HOIRE_BASE_URL}/open/token/get`, 
      `account=${encodeURIComponent(account)}&password=${encodeURIComponent(password)}&timestamp=${now}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    if (response.data?.code === 0 && response.data?.data?.token) {
      cachedToken = response.data.data.token;
      tokenExpiration = response.data.data.expiration;
      console.log("[Token] 获取成功, 过期时间:", new Date(tokenExpiration * 1000).toLocaleString());
      return cachedToken;
    }
    throw new Error(response.data?.message || "Failed to get token");
  }

  // 代理接口：订阅设备
  app.post("/api/hoire/subscribe", async (req, res) => {
    const { id, type } = req.body;
    try {
      const token = await getValidToken();
      const timestamp = Math.floor(Date.now() / 1000);
      const webhookUrl = `${APP_URL}/api/iot/receive`;
      
      let endpoint = '';
      if (type === 'weather') endpoint = `${HOIRE_BASE_URL}/open/monitor/subscribe`;
      else if (type === 'insect') endpoint = `${HOIRE_BASE_URL}/open/Insect/subscribe`;
      else if (type === 'camera') endpoint = `${HOIRE_BASE_URL}/open/camera/subscribe`;
      
      if (!endpoint) return res.status(400).json({ error: "Invalid device type" });

      console.log('[Subscribe] 发起订阅请求', { type, id, endpoint, webhookUrl, timestamp });

      const response = await axios.post(endpoint,
        `token=${encodeURIComponent(token)}&id=${id}&url=${encodeURIComponent(webhookUrl)}&timestamp=${timestamp}`,
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 5000
        }
      );
      
      lastSubscriptionResult = { type, id, data: response.data, time: new Date().toISOString() };
      console.log('[Subscribe] Hoire 返回', {
        type,
        id,
        code: response.data?.code,
        message: response.data?.message,
      });
      res.json(response.data);
    } catch (error: any) {
      console.error(`[订阅错误] ${type} (ID: ${id}):`, error.message);
      lastSubscriptionResult = {
        type,
        id,
        error: error.message,
        details: error.response?.data || null,
        webhookUrl: `${APP_URL}/api/iot/receive`,
        time: new Date().toISOString(),
      };
      res.status(500).json({ error: "Failed to subscribe to device", details: error.message });
    }
  });

  app.get('/api/site-binding', (req, res) => {
    const requestedSite = String(req.query.site || DEFAULT_SITE_KEY);
    const exists = Boolean(siteBindings[requestedSite]);
    const selected = exists ? siteBindings[requestedSite] : siteBindings[DEFAULT_SITE_KEY];
    const fallback = !exists;

    res.json({
      requestedSite,
      resolvedSite: fallback ? DEFAULT_SITE_KEY : requestedSite,
      exists,
      fallback,
      availableSites: Object.keys(siteBindings),
      binding: selected,
    });
  });

  app.post('/api/hoire/subscribe-by-site', async (req, res) => {
    const { site } = req.body;
    const requestedSite = site || DEFAULT_SITE_KEY;
    const selected = siteBindings[requestedSite] || siteBindings[DEFAULT_SITE_KEY];
    const resolvedSite = siteBindings[requestedSite] ? requestedSite : DEFAULT_SITE_KEY;

    try {
      const token = await getValidToken();

      const subscribeOne = async (id: number, type: 'weather' | 'insect' | 'camera') => {
        const timestamp = Math.floor(Date.now() / 1000);
        const webhookUrl = `${APP_URL}/api/iot/receive`;

        let endpoint = '';
        if (type === 'weather') endpoint = `${HOIRE_BASE_URL}/open/monitor/subscribe`;
        else if (type === 'insect') endpoint = `${HOIRE_BASE_URL}/open/Insect/subscribe`;
        else endpoint = `${HOIRE_BASE_URL}/open/camera/subscribe`;

        const response = await axios.post(endpoint,
          `token=${encodeURIComponent(token)}&id=${id}&url=${encodeURIComponent(webhookUrl)}&timestamp=${timestamp}`,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 5000,
          }
        );

        return { id, type, data: response.data };
      };

      const results = await Promise.allSettled([
        subscribeOne(selected.weatherId, 'weather'),
        subscribeOne(selected.insectId, 'insect'),
        subscribeOne(selected.cameraId, 'camera'),
      ]);

      const normalized = results.map((result, i) => {
        const typeMap: Array<'weather' | 'insect' | 'camera'> = ['weather', 'insect', 'camera'];
        const idMap = [selected.weatherId, selected.insectId, selected.cameraId];

        if (result.status === 'fulfilled') {
          return {
            status: 'fulfilled',
            type: typeMap[i],
            id: idMap[i],
            data: result.value.data,
          };
        }

        return {
          status: 'rejected',
          type: typeMap[i],
          id: idMap[i],
          reason: result.reason?.message || 'unknown error',
        };
      });

      lastSubscriptionResult = {
        mode: 'site',
        requestedSite,
        resolvedSite,
        binding: selected,
        results: normalized,
        time: new Date().toISOString(),
      };

      res.json(lastSubscriptionResult);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to subscribe by site',
        details: error.message,
      });
    }
  });

  // 新增：获取最后一次订阅结果
  app.get("/api/hoire/last-subscription-result", (req, res) => {
    res.json(lastSubscriptionResult);
  });

  // 代理接口：获取 Token
  app.get("/api/hoire/token", async (req, res) => {
    try {
      const account = process.env.HOIRE_ACCOUNT;
      const password = process.env.HOIRE_PASSWORD;
      const timestamp = Math.floor(Date.now() / 1000);
      console.log(`[Token] 请求: ${HOIRE_BASE_URL}/open/token/get, 账号: ${account}`);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/token/get`, 
        `account=${account}&password=${password}&timestamp=${timestamp}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      console.log("[Token] 响应:", response.data);
      res.json(response.data);
    } catch (error: any) {
      console.error("[Token] 错误:", error.message);
      res.status(500).json({ error: "Failed to get token", details: error.message });
    }
  });

  // 代理接口：获取设备列表
  app.get("/api/hoire/devices", async (req, res) => {
    try {
      const token = await getValidToken();
      const timestamp = Math.floor(Date.now() / 1000);
      console.log(`[Devices] 请求: ${HOIRE_BASE_URL}/open/monitor/list`);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/monitor/list`,
        `token=${encodeURIComponent(token)}&timestamp=${timestamp}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      console.log("[Devices] 响应:", response.data);
      res.json(response.data);
    } catch (error: any) {
      console.error("[Devices] 错误:", error.message);
      res.status(500).json({ error: "Failed to get devices", details: error.message });
    }
  });

  // 代理接口：获取虫情设备列表
  app.get("/api/hoire/insect-devices", async (req, res) => {
    try {
      const token = await getValidToken();
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/Insect/list`,
        `token=${encodeURIComponent(token)}&timestamp=${timestamp}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get insect devices" });
    }
  });

  // 代理接口：获取摄像头设备列表
  app.get("/api/hoire/camera-devices", async (req, res) => {
    try {
      const token = await getValidToken();
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/camera/list`,
        `token=${encodeURIComponent(token)}&timestamp=${timestamp}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get camera devices" });
    }
  });

  // 大数据平台农情监测接口代理
  app.post("/api/bigdata/growsHight", async (req, res) => {
    try {
      const { farmlandId, startTime, endTime, dimension = "Growth_status" } = req.body;
      
      if (!farmlandId) {
        return res.status(400).json({ error: "farmlandId is required" });
      }

      const bigDataToken = process.env.BIG_DATA_TOKEN;
      if (!bigDataToken) {
        console.warn("[BigData] BIG_DATA_TOKEN is not set in environment variables");
        return res.status(500).json({ error: "Server configuration error: Missing Big Data Token" });
      }

      const targetUrl = "http://cpca.hyspi.com:54082/center/base/growsHight";
      console.log(`[BigData] Requesting: ${targetUrl} for farmlandId: ${farmlandId}`);

      const response = await axios.post(
        targetUrl,
        {
          dimension,
          farmlandId,
          startTime: startTime || "2023-01-01 00:00:00",
          endTime: endTime || "2026-12-31 00:00:00"
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": bigDataToken
          },
          timeout: 10000
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("[BigData] Error calling growsHight API:", error.message);
      res.status(500).json({ 
        error: "Failed to fetch data from Big Data Platform", 
        details: error.response?.data || error.message 
      });
    }
  });

  // 测试接口：模拟推送数据
  app.get("/api/iot/test-push", (req, res) => {
    const weatherId = req.query.weatherId ? String(req.query.weatherId) : "1812";
    const insectId = req.query.insectId ? String(req.query.insectId) : "2734";

    const mockWeatherData = {
      id: Number(weatherId),
      code: "data",
      data: [
        { id: 1, code: "TEMP", name: "空气温度", value: 26.5, unit: "℃" },
        { id: 2, code: "HUMI", name: "空气湿度", value: 60.2, unit: "%" },
        { id: 3, code: "ILLU", name: "光照强度", value: 45000, unit: "Lux" },
        { id: 4, code: "WIND_SPD", name: "风速", value: 2.5, unit: "m/s" }
      ],
      time: new Date().toISOString()
    };

    const mockInsectData = {
      id: Number(insectId),
      code: "data",
      data: [
        { id: 10, code: "INSECT_CNT", name: "今日诱虫量", value: 128, unit: "只" },
        { id: 11, code: "PEST_TYPE", name: "主要害虫", value: "草地贪夜蛾", unit: "" }
      ],
      time: new Date().toISOString()
    };

    latestIotData[weatherId] = [{
      receiveTime: new Date().toISOString(),
      payload: mockWeatherData
    }];

    latestIotData[insectId] = [{
      receiveTime: new Date().toISOString(),
      payload: mockInsectData
    }];

    console.log(`模拟推送数据 (Weather: ${weatherId}, Insect: ${insectId})`);
    res.status(200).json({ code: 0, message: "模拟推送成功", data: { weather: mockWeatherData, insect: mockInsectData } });
  });

  app.get("/api/iot/latest", (req, res) => {
    res.status(200).json(latestIotData);
  });

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
    console.log(`[Startup] APP_URL=${APP_URL}`);
    console.log(`[Startup] Hoire callback URL=${APP_URL}/api/iot/receive`);
  });
}

startServer();
