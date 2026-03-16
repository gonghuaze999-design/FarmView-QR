import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOIRE_BASE_URL = 'https://api.hoire.cn';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const APP_URL = process.env.APP_URL?.replace(/\/$/, '');

  if (!APP_URL) {
    throw new Error('APP_URL 未配置，无法生成 Hoire 回调地址。请在环境变量中设置 APP_URL，例如: https://farm-api.example.com');
  }

  const isValidHttpUrl = /^https?:\/\//.test(APP_URL);
  if (!isValidHttpUrl) {
    throw new Error(`APP_URL 格式不合法: ${APP_URL}。必须以 http:// 或 https:// 开头。`);
  }

  // 内存存储最新数据和订阅结果
  let latestIotData: any = null;
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
    latestIotData = req.body;
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

  // 代理接口：订阅设备
  app.post("/api/hoire/subscribe", async (req, res) => {
    const { token, id, type } = req.body;
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const webhookUrl = `${APP_URL}/api/iot/receive`;
      
      let endpoint = '';
      if (type === 'weather') endpoint = `${HOIRE_BASE_URL}/open/monitor/subscribe`;
      else if (type === 'insect') endpoint = `${HOIRE_BASE_URL}/open/Insect/subscribe`;
      else if (type === 'camera') endpoint = `${HOIRE_BASE_URL}/open/camera/subscribe`;
      
      if (!endpoint) return res.status(400).json({ error: "Invalid device type" });

      console.log('[Subscribe] 发起订阅请求', { type, id, endpoint, webhookUrl, timestamp });

      const response = await axios.post(endpoint,
        `token=${token}&id=${id}&url=${encodeURIComponent(webhookUrl)}&timestamp=${timestamp}`,
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 5000 // 增加 5 秒超时
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
      const token = req.query.token;
      const timestamp = Math.floor(Date.now() / 1000);
      console.log(`[Devices] 请求: ${HOIRE_BASE_URL}/open/monitor/list`);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/monitor/list`,
        `token=${token}&timestamp=${timestamp}`,
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
      const token = req.query.token;
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/Insect/list`,
        `token=${token}&timestamp=${timestamp}`,
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
      const token = req.query.token;
      const timestamp = Math.floor(Date.now() / 1000);
      const response = await axios.post(`${HOIRE_BASE_URL}/open/camera/list`,
        `token=${token}&timestamp=${timestamp}`,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to get camera devices" });
    }
  });

  // 测试接口：模拟推送数据
  app.get("/api/iot/test-push", (req, res) => {
    const mockData = {
      id: 1812,
      code: "data",
      data: [
        { id: 3, code: "TRWD", name: "土壤温度", value: 25.89, unit: "℃" },
        { id: 4, code: "TRSF", name: "土壤水分", value: 4.97, unit: "%" }
      ],
      time: new Date().toISOString()
    };
    latestIotData = mockData;
    console.log("模拟推送数据:", JSON.stringify(mockData, null, 2));
    res.status(200).json({ code: 0, message: "模拟推送成功", data: mockData });
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
