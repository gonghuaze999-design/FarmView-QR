import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import 'dotenv/config';
import fs from 'fs';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import { HttpsProxyAgent } from 'https-proxy-agent';

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
let joinDb: any = null;
try {
  joinDb = new Database(path.join(dataDir, 'join_requests.db'));
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
  // 数据缓存持久化表
  joinDb.exec(`CREATE TABLE IF NOT EXISTS data_cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    ts INTEGER NOT NULL,
    ttl INTEGER NOT NULL
  )`);
  console.log('[DB] join_requests + data_cache 表已就绪');
} catch (e: any) {
  console.warn('[DB] SQLite 初始化失败（join_requests 功能不可用）:', e.message);
}

// 按 siteKey 分别缓存 Token
const tokenCache = new Map<string, string>();

// ── FarmMonitor（麦吉看田）配置 ──────────────────────
const FARM_MONITOR_BASE = 'https://farm-api.mcfly.com.cn/api/v1';
const FM_PASSWORD = '123456789';
const farmMonitorTokenCache = new Map<string, string>();
const satelliteCache = new Map<string, any[]>();        // siteKey → satellite records
const lastFetchDate = new Map<string, string>();         // siteKey → 'YYYY-MM-DD'
const setupLock = new Set<string>();                     // 防止并发初始化

// ── 数据缓存层 ──────────────────────────────────────
type CacheEntry = { data: any; ts: number; ttl: number };
const dataCache = new Map<string, CacheEntry>();          // cacheKey → { data, ts, ttl }

const CACHE_TTL: Record<string, number> = {
  'queryBaseData': 30 * 60_000,
  'areaTotal': 30 * 60_000,
  'mainCrop': 30 * 60_000,
  'QueryCropGrowth': 30 * 60_000,
  'land/list': 30 * 60_000,
  'locationList': 30 * 60_000,
  'cameraList': 10 * 60_000,
  'camera/count': 10 * 60_000,
  'getEnvInformationNew': 60 * 60_000,
  'getEnvRecordNow': 5 * 60_000,
  'querySoilReport': 30 * 60_000,
  'getInsectStatistics': 10 * 60_000,
  'getInsectImages': 10 * 60_000,
  'queryWorkTask': 15 * 60_000,
  'taskCount': 15 * 60_000,
  'growsHight': 15 * 60_000,
  'getCountByType': 10 * 60_000,
  'data-pack': 10 * 60_000,
  'default': 5 * 60_000,
};

function cacheKey(siteKey: string, method: string, path: string, body?: any): string {
  // 去掉时间字段避免每次请求生成不同 key
  const stable: any = {};
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      if (k === 'startTime' || k === 'endTime') continue;
      stable[k] = v;
    }
  }
  return `${siteKey}:${method}:${path}:${JSON.stringify(stable)}`;
}

function getCache(key: string): CacheEntry | null {
  // 先查内存
  const entry = dataCache.get(key);
  if (entry) {
    if (Date.now() - entry.ts > entry.ttl) {
      dataCache.delete(key);
    } else {
      return entry;
    }
  }
  // 内存未命中，查 SQLite
  if (joinDb) {
    try {
      const row = joinDb.prepare('SELECT data, ts, ttl FROM data_cache WHERE key = ?').get(key) as any;
      if (row) {
        if (Date.now() - row.ts > row.ttl) {
          joinDb.prepare('DELETE FROM data_cache WHERE key = ?').run(key);
        } else {
          const restored = { data: JSON.parse(row.data), ts: row.ts, ttl: row.ttl };
          dataCache.set(key, restored); // 恢复到内存
          return restored;
        }
      }
    } catch (_) { /* SQLite 读取失败，跳过 */ }
  }
  return null;
}

function setCache(key: string, data: any, ttl: number) {
  const entry: CacheEntry = { data, ts: Date.now(), ttl };
  dataCache.set(key, entry);
  // 持久化到 SQLite
  if (joinDb) {
    try {
      joinDb.prepare('INSERT OR REPLACE INTO data_cache (key, data, ts, ttl) VALUES (?, ?, ?, ?)').run(
        key, JSON.stringify(data), entry.ts, ttl
      );
    } catch (_) { /* SQLite 写入失败，内存缓存仍有效 */ }
  }
}

function clearSiteCache(siteKey: string) {
  const prefix = `${siteKey}:`;
  for (const key of dataCache.keys()) {
    if (key.startsWith(prefix)) dataCache.delete(key);
  }
  if (joinDb) {
    try {
      joinDb.prepare("DELETE FROM data_cache WHERE key LIKE ?").run(`${prefix}%`);
    } catch (_) { /* ignore */ }
  }
}

// 瘦身：气象/虫情数据只保留末尾有效记录（大幅减小响应体积）
function thinEnvData(data: any, count = 50): any {
  if (!data || typeof data !== 'object') return data;
  const thinned: any = {};
  for (const [dim, arr] of Object.entries(data)) {
    if (!Array.isArray(arr)) { thinned[dim] = arr; continue; }
    thinned[dim] = arr.slice(-count);
  }
  return thinned;
}

// 后台预加载基地缓存
async function prewarmCache(siteKey: string, username: string, password: string, baseId: number, farmlandIds: string[]) {
  console.log(`[Cache] 开始预加载基地 ${siteKey}...`);
  try {
    // 获取 token
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      username, password, code: 1, uuid: 'farmview', rememberMe: true,
    }, { timeout: 10000 });
    if (loginRes.data?.code !== 200) return;
    const token = loginRes.data.data.access_token;
    tokenCache.set(siteKey, token);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const fid = farmlandIds[0] || '';
    const now = new Date();
    const start180 = new Date(now.getTime() - 180 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
    const end = now.toISOString().replace('T', ' ').slice(0, 19);

    const tasks: Promise<any>[] = [
      // 基地统计
      axios.get(`${API_BASE}/farm/base/queryBaseData?baseId=${baseId}`, { headers, timeout: 15000 }).then(r => {
        if (r.data?.code === 200) setCache(cacheKey(siteKey, 'GET', '/farm/base/queryBaseData', { baseId }), r.data, CACHE_TTL.queryBaseData);
      }).catch(() => {}),
      // 地块列表
      axios.get(`${API_BASE}/farm/land/list?baseId=${baseId}`, { headers, timeout: 15000 }).then(r => {
        if (r.data?.code === 200) setCache(cacheKey(siteKey, 'GET', `/farm/land/list?baseId=${baseId}`), r.data, CACHE_TTL['land/list']);
      }).catch(() => {}),
      // 摄像头
      axios.post(`${API_BASE}/collect/collection/cameraList`, { baseId, farmlandIds: farmlandIds.join(',') }, { headers, timeout: 15000 }).then(r => {
        if (r.data?.code === 200) setCache(cacheKey(siteKey, 'POST', '/collect/collection/cameraList', { baseId, farmlandIds: farmlandIds.join(',') }), r.data, CACHE_TTL.cameraList);
      }).catch(() => {}),
    ];
    // 气象（2组并行，每组[3,200]渐进，count=10，与前端缓存key一致）
    for (const dim of ['air_temperature,air_humidity,wind_speed,precipitation,light_intensity,atmospheric_pressure', 'soil_temperature,soil_humidity,soil_ec']) {
      tasks.push((async () => {
        for (const days of [3, 200]) {
          const start = new Date(now.getTime() - days * 86400000).toISOString().replace('T', ' ').slice(0, 19);
          try {
            const r = await axios.post(`${API_BASE}/collect/iot/getEnvInformationNew`, {
              farmlandId: fid, dimension: dim, startTime: start, endTime: end,
            }, { headers, timeout: 120000 });
            if (r.data?.code === 200 && r.data?.data) {
              const hasData = Object.values(r.data.data).some((v: any) => Array.isArray(v) && v.length > 0);
              if (hasData) {
                r.data.data = thinEnvData(r.data.data, 10);
                setCache(cacheKey(siteKey, 'POST', '/collect/iot/getEnvInformationNew', { farmlandId: fid, dimension: dim, count: 10 }), r.data, CACHE_TTL.getEnvInformationNew);
                console.log(`[Cache] 预加载气象 ${siteKey} ${dim.slice(0,15)}... OK (${days}天)`);
                return;
              }
            }
          } catch (_) { /* 继续下一档 */ }
        }
        console.log(`[Cache] 预加载气象 ${siteKey} ${dim.slice(0,15)}... 无数据`);
      })());
    }

    await Promise.allSettled(tasks);
    console.log(`[Cache] 基地 ${siteKey} 预加载完成`);
  } catch (e: any) {
    console.warn(`[Cache] 预加载 ${siteKey} 失败:`, e.message);
  }
}

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
  }, { timeout: 10000 });

  const token = res.data?.data?.access_token;
  if (!token) throw new Error('登录接口未返回有效 Token');

  tokenCache.set(siteKey, token);
  console.log(`[Auth] 基地 ${siteKey} Token 获取成功`);
  return token;
}

// ── FarmMonitor 辅助函数 ─────────────────────────

function wktToGeoJson(wkt: string): { type: 'Polygon'; coordinates: number[][][] } | null {
  if (!wkt) return null;
  const rings: number[][][] = [];
  const ringRegex = /\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = ringRegex.exec(wkt)) !== null) {
    const points: number[][] = [];
    const pairs = match[1].split(',');
    for (const p of pairs) {
      const parts = p.trim().split(/\s+/);
      if (parts.length >= 2) {
        const lng = Number(parts[0]), lat = Number(parts[1]);
        if (!isNaN(lng) && !isNaN(lat)) points.push([lng, lat]);
      }
    }
    if (points.length === 0) return null;
    const first = points[0], last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first]);
    rings.push(points);
  }
  return rings.length > 0 ? { type: 'Polygon' as const, coordinates: rings } : null;
}

async function getFarmMonitorToken(siteKey: string): Promise<string> {
  if (farmMonitorTokenCache.has(siteKey)) return farmMonitorTokenCache.get(siteKey)!;

  const site = sitesConfig.sites[siteKey];
  const email = site?.farmMonitor?.email || `fm_${siteKey}@farmview.local`;

  console.log(`[FarmMonitor] 正在登录 ${email}...`);
  const res = await axios.post(`${FARM_MONITOR_BASE}/auth/login`, {
    email,
    password: FM_PASSWORD,
  }, { timeout: 10000 });

  if (res.data?.code !== 200) {
    throw new Error(`FarmMonitor 登录失败: ${res.data?.message || '未知错误'}`);
  }
  const token = res.data?.data?.token;
  if (!token) throw new Error('FarmMonitor 登录未返回 token');
  farmMonitorTokenCache.set(siteKey, token);
  console.log(`[FarmMonitor] ${email} 登录成功`);
  return token;
}

async function ensureFarmMonitorSetup(siteKey: string): Promise<boolean> {
  const site = sitesConfig.sites[siteKey];
  if (!site) return false;

  // 已完成初始化
  if (site.farmMonitor?.farmId && site.farmMonitor?.fieldMap) return true;

  // 防止并发初始化
  if (setupLock.has(siteKey)) {
    // 等待初始化完成（最多等 5 分钟）
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      // 重新加载配置
      try {
        const raw = fs.readFileSync(path.join(__dirname, 'sites-config.json'), 'utf-8');
        const cfg = JSON.parse(raw);
        if (cfg.sites[siteKey]?.farmMonitor?.farmId) {
          sitesConfig.sites[siteKey] = cfg.sites[siteKey];
          return true;
        }
      } catch {}
      if (!setupLock.has(siteKey)) break; // 初始化完成
    }
    return !!sitesConfig.sites[siteKey]?.farmMonitor?.farmId;
  }

  setupLock.add(siteKey);
  console.log(`[FarmMonitor] ===== 开始初始化基地 ${siteKey} =====`);

  try {
    const siteName = site.siteName || siteKey;
    const email = `fm_${siteKey}@farmview.local`;

    // Step 1: 注册（如果已注册会返回 400，忽略）
    let token: string | undefined;
    try {
      console.log(`[FarmMonitor] Step 1: 注册账号 ${email}`);
      const regRes = await axios.post(`${FARM_MONITOR_BASE}/auth/register`, {
        email,
        name: siteName,
        password: FM_PASSWORD,
      }, { timeout: 10000, validateStatus: () => true });
      if (regRes.data?.code === 201) {
        token = regRes.data?.data?.token;
        console.log(`[FarmMonitor] 注册成功，直接获得 token`);
      } else if (regRes.data?.code === 400 && regRes.data?.message?.includes('已注册')) {
        console.log(`[FarmMonitor] 账号已存在，走登录流程`);
      } else {
        console.log(`[FarmMonitor] 注册返回: ${regRes.data?.code} ${regRes.data?.message}`);
      }
    } catch (e: any) {
      console.log(`[FarmMonitor] 注册请求异常: ${e.message}，尝试登录`);
    }

    // Step 2: 登录获取 token
    if (!token) {
      token = await getFarmMonitorToken(siteKey);
    } else {
      farmMonitorTokenCache.set(siteKey, token);
    }
    const fmHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Step 3: 创建 Farm
    console.log(`[FarmMonitor] Step 3: 创建基地 "${siteName}"`);
    const farmRes = await axios.post(`${FARM_MONITOR_BASE}/farms`, {
      name: siteName,
    }, { headers: fmHeaders, timeout: 10000, validateStatus: () => true });
    let farmId: string;
    if (farmRes.data?.code === 201) {
      farmId = farmRes.data.data.id;
      console.log(`[FarmMonitor] 基地创建成功: ${farmId}`);
    } else if (farmRes.data?.code === 400) {
      // 可能已存在，查询已有 farm
      const listRes = await axios.get(`${FARM_MONITOR_BASE}/farms`, { headers: fmHeaders, timeout: 10000 });
      const existing = listRes.data?.data?.find((f: any) => f.name === siteName);
      if (existing) {
        farmId = existing.id;
        console.log(`[FarmMonitor] 基地已存在: ${farmId}`);
      } else {
        throw new Error(`创建基地失败: ${JSON.stringify(farmRes.data)}`);
      }
    } else {
      throw new Error(`创建基地失败: ${JSON.stringify(farmRes.data)}`);
    }

    // Step 4: 获取数字农田地块数据
    console.log(`[FarmMonitor] Step 4: 获取数字农田地块数据`);
    const landToken = await getTokenForSite(siteKey);
    const landRes = await axios.get(`${API_BASE}/farm/land/list?baseId=${site.baseId}`, {
      headers: { Authorization: `Bearer ${landToken}` },
      timeout: 15000,
    });
    const lands = landRes.data?.code === 200 ? (landRes.data?.data || []) : [];
    console.log(`[FarmMonitor] 共 ${lands.length} 块地块`);

    // Step 4b: 获取 FarmMonitor 已有地块（支持断点续传）
    let existingFields: any[] = [];
    try {
      const efRes = await axios.get(`${FARM_MONITOR_BASE}/fields?farm_id=${farmId}`, {
        headers: fmHeaders, timeout: 10000,
      });
      if (efRes.data?.code === 200 && Array.isArray(efRes.data?.data)) {
        existingFields = efRes.data.data;
        console.log(`[FarmMonitor] FarmMonitor 已有 ${existingFields.length} 个地块`);
      }
    } catch (e: any) {
      console.log(`[FarmMonitor] 查询已有地块失败: ${e.message}，将全部重新创建`);
    }
    const existingByName = new Map<string, string>();
    for (const ef of existingFields) {
      if (ef.name) existingByName.set(ef.name, ef.id);
    }

    // Step 5: 创建/映射所有 Field（已有则跳过）
    const fieldMap: Record<string, string> = {};
    const fieldIdsToFetch: string[] = [];

    for (const land of lands) {
      const landId = String(land.id);
      const landName = land.farmlandName || `地块${landId}`;
      const wkt = land.mapPolygonGeo;

      if (!wkt) {
        console.log(`[FarmMonitor] 跳过 ${landName}: 无多边形边界`);
        continue;
      }

      // 断点续传：已存在的地块直接映射，也加入订阅列表（FarmMonitor 自动跳过已订阅的）
      const existingId = existingByName.get(landName);
      if (existingId) {
        fieldMap[landId] = existingId;
        fieldIdsToFetch.push(existingId);
        console.log(`[FarmMonitor] ${landName} 已存在 → ${existingId}`);
        continue;
      }

      const geojson = wktToGeoJson(wkt);
      if (!geojson) {
        console.log(`[FarmMonitor] 跳过 ${landName}: WKT解析失败`);
        continue;
      }

      try {
        console.log(`[FarmMonitor] 创建地块: ${landName}`);
        const fieldRes = await axios.post(`${FARM_MONITOR_BASE}/fields`, {
          farm_id: farmId,
          name: landName,
          crop_type: land.cropsName || '',
          boundary: geojson,
        }, { headers: fmHeaders, timeout: 30000, validateStatus: () => true });

        if (fieldRes.data?.code === 201) {
          const fieldId = fieldRes.data.data.id;
          fieldMap[landId] = fieldId;
          fieldIdsToFetch.push(fieldId);
          console.log(`[FarmMonitor]   → fieldId: ${fieldId}`);
        } else {
          console.log(`[FarmMonitor]   ${landName} 创建返回: code=${fieldRes.data?.code} ${fieldRes.data?.message || ''}`);
        }
      } catch (e: any) {
        console.error(`[FarmMonitor] 创建地块 ${landName} 异常: ${e.message}`);
      }
    }

    // Step 6: 立即保存配置
    site.farmMonitor = { email, farmId, fieldMap };
    sitesConfig.sites[siteKey] = site;
    const configPath = path.join(__dirname, 'sites-config.json');
    fs.writeFileSync(configPath, JSON.stringify(sitesConfig, null, 2), 'utf-8');
    console.log(`[FarmMonitor] 配置已保存，共 ${Object.keys(fieldMap).length} 个地块`);

    // Step 7: 基地级订阅 — 只对新地块触发卫星检索
    if (fieldIdsToFetch.length > 0) {
      console.log(`[FarmMonitor] 基地级订阅：触发 ${fieldIdsToFetch.length} 个新地块卫星检索`);
      for (const fieldId of fieldIdsToFetch) {
        try {
          const fetchRes = await axios.post(`${FARM_MONITOR_BASE}/satellite/field/${fieldId}/fetch`, {}, {
            headers: fmHeaders, timeout: 10000, validateStatus: () => true,
          });
          console.log(`[FarmMonitor]   field ${fieldId} 订阅已触发 (code=${fetchRes.data?.code})`);
        } catch (e: any) {
          console.error(`[FarmMonitor]   field ${fieldId} 订阅触发失败: ${e.message}`);
        }
      }
    } else {
      console.log(`[FarmMonitor] 无新地块，跳过卫星订阅`);
    }

    console.log(`[FarmMonitor] ===== 基地 ${siteKey} 初始化完成 =====`);
    return true;
  } catch (e: any) {
    console.error(`[FarmMonitor] 初始化失败:`, e.message);
    return false;
  } finally {
    setupLock.delete(siteKey);
  }
}

async function fetchSatelliteForSite(siteKey: string): Promise<void> {
  const site = sitesConfig.sites[siteKey];
  if (!site?.farmMonitor?.fieldMap) return;

  const token = await getFarmMonitorToken(siteKey);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const allRecords: any[] = [];

  const fieldMap = site.farmMonitor.fieldMap as Record<string, string>;
  for (const [localId, fieldId] of Object.entries(fieldMap)) {
    try {
      const res = await axios.get(`${FARM_MONITOR_BASE}/satellite/field/${fieldId}`, {
        headers, timeout: 15000,
      });
      if (res.data?.code === 200 && Array.isArray(res.data?.data)) {
        for (const rec of res.data.data) {
          allRecords.push({ ...rec, _localFieldId: localId });
        }
      }
    } catch (e: any) {
      console.error(`[FarmMonitor] 拉取 field ${fieldId} 卫星数据失败: ${e.message}`);
    }
  }

  // 跨地块按日期倒序排列
  allRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  satelliteCache.set(siteKey, allRecords);

  const today = new Date().toISOString().slice(0, 10);
  lastFetchDate.set(siteKey, today);
  console.log(`[FarmMonitor] 基地 ${siteKey} 缓存了 ${allRecords.length} 条卫星记录`);
}

function isBeijing8am(): boolean {
  const now = new Date();
  const bjHour = now.getUTCHours() + 8; // UTC+8
  return bjHour === 8 && now.getUTCMinutes() < 60;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- 自定义路由（必须在代理之前）---

  // 申报/加入 表单提交
  app.post('/api/join-request', (req, res) => {
    if (!joinDb) return res.status(503).json({ error: '数据库服务暂不可用' });
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
    if (!joinDb) return res.status(503).json({ error: '数据库服务暂不可用' });
    const rows = joinDb.prepare('SELECT * FROM join_requests ORDER BY created_at DESC').all();
    res.json({ ok: true, total: rows.length, data: rows });
  });

  // 验证数字农田账号并返回基地列表
  app.post('/api/admin/verify-auth', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '缺少账号密码' });
    try {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        username, password, code: 1, uuid: 'farmview', rememberMe: true,
      }, { timeout: 10000 });
      if (loginRes.data?.code !== 200) return res.json({ ok: false, error: loginRes.data?.msg || '登录失败' });

      const token = loginRes.data.data.access_token;
      const headers = { Authorization: `Bearer ${token}` };
      const baseRes = await axios.get(`${API_BASE}/farm/base/queryBaseList`, { headers, timeout: 10000 });
      if (baseRes.data?.code !== 200) return res.json({ ok: false, error: '获取基地列表失败' });

      res.json({ ok: true, token, bases: baseRes.data.data || [] });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    }
  });

  // 获取某基地下的地块列表（用临时token）
  app.post('/api/admin/get-lands', async (req, res) => {
    const { token, baseId } = req.body;
    if (!token || !baseId) return res.status(400).json({ error: '缺少参数' });
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const landRes = await axios.get(`${API_BASE}/farm/land/list?baseId=${baseId}`, { headers, timeout: 10000 });
      if (landRes.data?.code !== 200) return res.json({ ok: false, error: '获取地块失败' });
      res.json({ ok: true, lands: landRes.data.data || [] });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    }
  });

  // 新增基地配置
  app.post('/api/admin/add-site', async (req, res) => {
    const { siteKey, siteName, owner, apiAuth, baseId, farmlandIds } = req.body;
    if (!siteKey || !siteName || !apiAuth?.username || !apiAuth?.password || !baseId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    if (sitesConfig.sites[siteKey]) return res.status(400).json({ error: `基地标识 ${siteKey} 已存在` });

    sitesConfig.sites[siteKey] = {
      siteName, owner: owner || 'admin', apiAuth, baseId,
      farmlandIds: farmlandIds || [],
      devices: { weatherIds: [], insectIds: [], cameraIds: [] },
    };

    const configPath = path.join(__dirname, 'sites-config.json');
    fs.writeFileSync(configPath, JSON.stringify(sitesConfig, null, 2), 'utf-8');
    console.log(`[Admin] 新增基地 ${siteKey} → ${siteName}`);

    // 后台异步预加载缓存
    prewarmCache(siteKey, apiAuth.username, apiAuth.password, baseId, farmlandIds || []);

    res.json({ ok: true, siteKey, url: `/site=${siteKey}` });
  });

  // 删除基地
  app.post('/api/admin/delete-site', async (req, res) => {
    const { siteKey, cleanupFarmMonitor } = req.body;
    if (!siteKey) return res.status(400).json({ error: '缺少 siteKey' });
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: `基地 ${siteKey} 不存在` });

    const siteName = site.siteName || siteKey;

    // 同步取消麦吉看田服务
    if (cleanupFarmMonitor && site.farmMonitor?.farmId) {
      const { farmId, fieldMap, email } = site.farmMonitor as { farmId: string; fieldMap: Record<string, string>; email?: string };
      console.log(`[Admin] 同步取消麦吉看田：farmId=${farmId}，fields=${fieldMap ? Object.keys(fieldMap).length : 0}个`);
      try {
        const fmKey = siteKey;
        let token = farmMonitorTokenCache.get(fmKey);
        if (!token) {
          const loginRes = await axios.post(`${FARM_MONITOR_BASE}/auth/login`, {
            email: email || `fm_${siteKey}@farmview.local`,
            password: FM_PASSWORD,
          }, { timeout: 10000 });
          if (loginRes.data?.code === 200) {
            token = loginRes.data.data.token;
          }
        }
        if (token) {
          const fmHeaders = { Authorization: `Bearer ${token}` };
          // 删除所有地块
          if (fieldMap) {
            for (const fieldId of Object.values(fieldMap)) {
              try {
                await axios.delete(`${FARM_MONITOR_BASE}/fields/${fieldId}`, { headers: fmHeaders, timeout: 8000 });
                console.log(`[FarmMonitor] 已删除地块 ${fieldId}`);
              } catch (e: any) {
                console.warn(`[FarmMonitor] 删除地块 ${fieldId} 失败:`, e.message);
              }
            }
          }
          // 删除农场
          try {
            await axios.delete(`${FARM_MONITOR_BASE}/farms/${farmId}`, { headers: fmHeaders, timeout: 8000 });
            console.log(`[FarmMonitor] 已删除农场 ${farmId}`);
          } catch (e: any) {
            console.warn(`[FarmMonitor] 删除农场 ${farmId} 失败:`, e.message);
          }
        }
      } catch (e: any) {
        console.warn(`[Admin] FarmMonitor 清理异常:`, e.message);
      }
    }

    delete sitesConfig.sites[siteKey];

    const configPath = path.join(__dirname, 'sites-config.json');
    fs.writeFileSync(configPath, JSON.stringify(sitesConfig, null, 2), 'utf-8');

    // 清空所有缓存
    farmMonitorTokenCache.delete(siteKey);
    setupLock.delete(siteKey);
    clearSiteCache(siteKey);
    tokenCache.delete(siteKey);

    console.log(`[Admin] 已删除基地 ${siteKey} → ${siteName}`);
    res.json({ ok: true });
  });

  // 获取所有基地列表（含FarmMonitor状态）
  app.get('/api/admin/sites', (req, res) => {
    const list = Object.entries(sitesConfig.sites).map(([key, site]: [string, any]) => ({
      siteKey: key,
      siteName: site.siteName,
      owner: site.owner,
      baseId: site.baseId,
      landCount: (site.farmlandIds || []).length,
      hasFarmMonitor: !!(site.farmMonitor?.farmId),
      fmFieldCount: site.farmMonitor?.fieldMap ? Object.keys(site.farmMonitor.fieldMap).length : 0,
    }));
    res.json({ ok: true, data: list });
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

      const img = sharp(buffer);
      const { width, height } = await img.metadata();
      const rawBuf = await img.greyscale().raw().toBuffer();

      // 提取灰度值
      const pixels: number[] = Array.from(rawBuf);

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

      const pngBuf = await sharp(out, { raw: { width: width!, height: height!, channels: 4 } }).png().toBuffer();
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

  // ── AI 数据包 ──────────────────────────────────────────
  // 构建基地数据包（markdown格式，供AI和评估共用）
  async function buildDataPack(siteKey: string): Promise<string> {
    const site = sitesConfig.sites[siteKey];
    if (!site) throw new Error('基地不存在');
    const token = await getTokenForSite(siteKey);
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const baseId = site.baseId;
    const farmlandId = site.farmlandIds?.[0] || '';
    const now = new Date();
    try {
    const yearStart = `${now.getFullYear()}-01-01 00:00:00`;
    const today = now.toISOString().replace('T', ' ').slice(0, 10) + ' 23:59:59';
    const halfYearAgo = new Date(now.getTime() - 180 * 86400000).toISOString().replace('T', ' ').slice(0, 19);
    const pack: string[] = [];

      pack.push(`## 基地概况`);
      pack.push(`- 基地名称：${site.siteName}`);
      pack.push(`- 基地 ID：${baseId}`);
      pack.push(`- 数据更新时间：${now.toLocaleString('zh-CN')}`);

      // 基地统计数据
      try {
        const [baseData, areaTotal, mainCrop, cropGrowth] = await Promise.allSettled([
          axios.get(`${API_BASE}/farm/base/queryBaseData?baseId=${baseId}`, { headers, timeout: 8000 }),
          axios.get(`${API_BASE}/farm/batch/areaTotal?baseId=${baseId}`, { headers, timeout: 8000 }),
          axios.get(`${API_BASE}/farm/batch/mainCrop?baseId=${baseId}`, { headers, timeout: 8000 }),
          axios.post(`${API_BASE}/center/base/QueryCropGrowth`, { baseId }, { headers, timeout: 8000 }),
        ]);
        const bd = baseData.status === 'fulfilled' ? baseData.value.data?.data : null;
        const at = areaTotal.status === 'fulfilled' ? areaTotal.value.data?.data : null;
        const mc = mainCrop.status === 'fulfilled' ? mainCrop.value.data?.msg : null;
        const cg = cropGrowth.status === 'fulfilled' ? cropGrowth.value.data?.data : null;

        pack.push(`\n## 基地统计`);
        if (bd) pack.push(`- 地块总数：${bd.landAccount || 0}，作物种类：${bd.cropAccount || 0}`);
        if (at != null) pack.push(`- 种植总面积：${Number(at).toLocaleString()} 亩`);
        if (mc) pack.push(`- 主要作物：${mc}`);
        if (cg) {
          const firstCrop = Object.values(cg)[0] as any[];
          if (firstCrop?.[0]) {
            pack.push(`- 当前生育期：${firstCrop[0].growthName || '—'}（${firstCrop[0].cropsName || ''}）`);
          }
        }
      } catch (e: any) { pack.push(`\n## 基地统计\n获取失败：${e.message}`); }

      // 地块列表
      try {
        const landRes = await axios.get(`${API_BASE}/farm/land/list?baseId=${baseId}`, { headers, timeout: 8000 });
        if (landRes.data?.code === 200 && landRes.data?.data?.length > 0) {
          const lands = landRes.data.data;
          const totalSize = lands.reduce((s: number, l: any) => s + (Number(l.size) || 0), 0);
          pack.push(`\n## 地块列表（共 ${lands.length} 块，合计 ${totalSize.toFixed(1)} 亩）`);
          lands.slice(0, 8).forEach((l: any, i: number) => {
            pack.push(`${i + 1}. ${l.farmlandName || '地块' + l.id}｜${Number(l.size || 0).toFixed(1)}亩｜${l.mapType || ''}`);
          });
        }
      } catch (e: any) { pack.push(`\n## 地块列表\n获取失败：${e.message}`); }

      // 农事行为
      try {
        const taskRes = await axios.post(`${API_BASE}/farm/work/queryWorkTask`, {
          baseId, startTime: yearStart, endTime: today, pageNum: 1, pageSize: 20,
        }, { headers, timeout: 8000 });
        if (taskRes.data?.code === 200 && taskRes.data?.data?.rows) {
          const tasks = taskRes.data.data.rows;
          pack.push(`\n## 农事行为（${now.getFullYear()}年，共 ${taskRes.data.data.total || tasks.length} 条）`);
          const statusMap: Record<number, string> = { 0: '未开始', 1: '未分配', 2: '进行中', 3: '已完成', 4: '已取消' };
          tasks.slice(0, 8).forEach((t: any) => {
            const status = statusMap[t.status] || '未知';
            pack.push(`- [${status}] ${t.taskName}｜${t.landName || '-'}｜${t.cropsName || ''}｜${t.scheduledStartTime?.slice(0, 10) || ''} → ${t.scheduledEndTime?.slice(0, 10) || ''}`);
          });
          const completed = tasks.filter((t: any) => t.status === 3).length;
          const inProgress = tasks.filter((t: any) => t.status === 2).length;
          pack.push(`- 统计：已完成 ${completed}，进行中 ${inProgress}`);
        }
      } catch (e: any) { pack.push(`\n## 农事行为\n获取失败：${e.message}`); }

      // IoT 气象（count模式，走代理缓存，秒返）
      try {
        const dimMeta: Record<string, [string, string]> = {
          air_temperature: ['空气温度', '°C'], air_humidity: ['空气湿度', '%'],
          wind_speed: ['风速', 'm/s'], precipitation: ['降水量', 'mm'],
          light_intensity: ['光照强度', 'lux'], atmospheric_pressure: ['大气压', 'hPa'],
          soil_temperature: ['土壤温度', '°C'], soil_humidity: ['土壤水分', '%'],
          soil_ec: ['土壤EC值', 'μS/cm'],
        };
        const wxHeaders = { ...headers, 'X-Site-Name': siteKey };
        const wxBase = `http://localhost:${PORT}/api/collect/iot/getEnvInformationNew`;
        const [r1, r2] = await Promise.allSettled([
          axios.post(wxBase, { farmlandId, dimension: 'air_temperature,air_humidity,wind_speed,precipitation,light_intensity,atmospheric_pressure', count: 10 }, { headers: wxHeaders, timeout: 15000 }),
          axios.post(wxBase, { farmlandId, dimension: 'soil_temperature,soil_humidity,soil_ec', count: 10 }, { headers: wxHeaders, timeout: 15000 }),
        ]);
        pack.push(`\n## IoT气象监测`);
        for (const dim of Object.keys(dimMeta)) {
          for (const r of [r1, r2]) {
            if (r.status !== 'fulfilled' || !r.value.data?.data?.[dim]) continue;
            const arr = r.value.data.data[dim];
            if (!Array.isArray(arr)) continue;
            for (let i = arr.length - 1; i >= 0; i--) {
              const v = arr[i][dim];
              if (v != null && v !== 0) {
                const [label, unit] = dimMeta[dim];
                pack.push(`- ${label}：${typeof v === 'number' ? v.toFixed(1) : v}${unit}（末次 ${arr[i].reportTime || '未知'}）`);
                break;
              }
            }
            break; // 从一个请求里找到了，跳过另一个
          }
        }
      } catch (e: any) { pack.push(`\n## IoT气象\n获取失败：${e.message}`); }

      // 土壤检测
      try {
        const soilRes = await axios.post(`${API_BASE}/center/base/querySoilReport`, {
          baseId, startTime: '2020-01-01', endTime: '2026-12-31',
        }, { headers, timeout: 8000 });
        const soilData = soilRes.data?.soil || soilRes.data?.data;
        if (Array.isArray(soilData) && soilData.length > 0) {
          const last = soilData[soilData.length - 1];
          pack.push(`\n## 土壤检测（共${soilData.length}次采样，最近点位：${last.report_farm || last.reportTime || '未知'}）`);
          const soilFields = [
            ['nitrogen','soil_nitrogen','全氮','g/kg'],
            ['phosphorus','soil_phosphorus','有效磷','mg/kg'],
            ['potassium','soil_potassium','缓效钾','mg/kg'],
            ['organicMatter',null,'有机质','g/kg'],
            ['ph','soil_ph','pH值',''],
            ['soil_ec',null,'土壤EC','μS/cm'],
          ];
          for (const [k1, k2, label, unit] of soilFields) {
            const v = last[k1] ?? (k2 ? last[k2] : null);
            if (v != null) pack.push(`- ${label}：${v}${unit}`);
          }
        }
      } catch (e: any) { pack.push(`\n## 土壤检测\n获取失败：${e.message}`); }

      // 虫情统计
      try {
        const insectRes = await axios.post(`${API_BASE}/collect/iot/getInsectStatistics`, {
          farmlandId, startTime: halfYearAgo, endTime: today,
        }, { headers, timeout: 8000 });
        if (insectRes.data?.code === 200 && insectRes.data?.data) {
          const data = insectRes.data.data;
          pack.push(`\n## 虫情监测`);
          pack.push(`- 累计诱虫：${data.total || 0} 只`);
          if (data.insect?.length > 0) {
            data.insect.slice(0, 5).forEach((item: any) => {
              pack.push(`- ${item.insectName}：${item.insectValue}只（${item.percent || '—'}）`);
            });
          }
        }
      } catch (e: any) { pack.push(`\n## 虫情监测\n获取失败：${e.message}`); }

      // 设备统计
      try {
        const [devRes, camRes] = await Promise.allSettled([
          axios.get(`${API_BASE}/collect/iot/getCountByType?baseId=${baseId}`, { headers, timeout: 8000 }),
          axios.get(`${API_BASE}/collect/camera/count?baseId=${baseId}`, { headers, timeout: 8000 }),
        ]);
        pack.push(`\n## 设备统计`);
        if (devRes.status === 'fulfilled' && Array.isArray(devRes.value.data?.data)) {
          const devs = devRes.value.data.data;
          const totalDev = devs.reduce((s: number, d: any) => s + (d.count || 0), 0);
          pack.push(`- IoT设备总数：${totalDev}（睿瞳${devs.find((d:any)=>d.type==='ruitong')?.count||0}、环境${devs.find((d:any)=>d.type==='monitor')?.count||0}、虫情${devs.find((d:any)=>d.type==='insect')?.count||0}）`);
        }
        if (camRes.status === 'fulfilled' && camRes.value.data?.code === 200) {
          pack.push(`- 摄像头：${camRes.value.data.data ?? '?'} 个`);
        }
      } catch (e: any) { pack.push(`\n## 设备统计\n获取失败：${e.message}`); }

      // FarmMonitor 卫星数据摘要
      if (satelliteCache.has(siteKey)) {
        const records = satelliteCache.get(siteKey)!;
        if (records.length > 0) {
          pack.push(`\n## 卫星遥感（FarmMonitor，最近${Math.min(records.length, 5)}条）`);
          records.slice(0, 5).forEach((r: any) => {
            const mean = r.ndvi_stats?.mean;
            const grade = mean != null ? (mean >= 0.7 ? '优' : mean >= 0.55 ? '良' : mean >= 0.35 ? '中' : '差') : '—';
            pack.push(`- ${r.date?.slice(0, 10) || '?'}｜NDVI均值 ${mean?.toFixed(3) || '?'}｜评级：${grade}`);
          });
        }
      }

      return pack.join('\n');
    } catch (e: any) {
      console.error('[DataPack] 构建失败:', e.message);
      return `## 数据包构建失败\n${e.message}`;
    }
  }

  app.get('/api/ai/data-pack', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    try {
      const pack = await buildDataPack(siteKey);
      res.json({ ok: true, dataPack: pack, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── AI 值班专家：定期评估 ─────────────────────────
  const ASSESSMENT_PROMPT = `你是 FarmView 基地值班农业技术专家，7×24小时在线监控基地运行状态。
请基于以下基地数据包，从各维度逐项评估，输出严格JSON（不要markdown代码块）：

{
  "level": "normal|urgent",
  "summary": "一句话总结基地整体状况",
  "items": [
    { "category": "气象", "level": "normal|urgent", "detail": "具体描述" },
    { "category": "土壤", "level": "normal|urgent", "detail": "具体描述" },
    { "category": "虫情", "level": "normal|urgent", "detail": "具体描述" },
    { "category": "农事", "level": "normal|urgent", "detail": "具体描述" },
    { "category": "遥感", "level": "normal|urgent", "detail": "具体描述" },
    { "category": "综合", "level": "normal|urgent", "detail": "综合风险和行动建议" }
  ]
}

判断标准：
- 气象：温度<0°C或>40°C、湿度<10%或>95%、风速>20m/s、连续3天无降水标记为urgent
- 土壤：pH<4或>9、有机质<10g/kg标记为urgent
- 虫情：单类占比>50%或累计诱虫周增幅>100%标记为urgent
- 农事：超期任务>5条、完成率<30%标记为urgent
- 遥感：NDVI趋势连续下降>0.1标记为urgent
- 综合：上述urgent>=2项则综合level为urgent`;

  interface AssessmentItem { category: string; level: string; detail: string; }
  interface Assessment { level: string; summary: string; items: AssessmentItem[]; }

  async function assessSite(siteKey: string): Promise<Assessment | null> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) { console.warn('[Assess] GEMINI_API_KEY 未配置'); return null; }
    try {
      const pack = await buildDataPack(siteKey);
      const res = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        { system_instruction: { parts: [{ text: ASSESSMENT_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: pack }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } },
        { headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' }, timeout: 60000 }
      );
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      // 去掉所有markdown格式，提取纯JSON
      const cleanText = text.replace(/```(?:json)?/g, '').replace(/`/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { console.warn('[Assess] 未找到JSON, 原始:', text.slice(0, 500), '| 清洗后:', cleanText.slice(0, 500)); return null; }
      const result: Assessment = JSON.parse(jsonMatch[0]);
      result.items = result.items || [];
      // 持久化
      setCache(`${siteKey}:assessment:latest`, result, 60 * 60_000);
      // 紧急通知
      const urgents = result.items.filter(i => i.level === 'urgent');
      if (urgents.length > 0 || result.level === 'urgent') {
        const existing = getCache(`${siteKey}:notifications:unread`);
        const notifs: any[] = existing?.data || [];
        urgents.forEach(u => notifs.unshift({ ...u, time: new Date().toISOString() }));
        setCache(`${siteKey}:notifications:unread`, notifs.slice(0, 20), 24 * 60 * 60_000);
      }
      console.log(`[Assess] ${siteKey}: ${result.level}, ${result.items.length}项, urgent=${urgents.length}`);
      return result;
    } catch (e: any) { console.warn(`[Assess] ${siteKey} 失败:`, e.message); return null; }
  }

  // 启动时立即评估一次，之后每30分钟
  setTimeout(() => { for (const sk of Object.keys(sitesConfig.sites)) assessSite(sk); }, 10000);
  setInterval(() => { for (const sk of Object.keys(sitesConfig.sites)) assessSite(sk); }, 30 * 60_000);

  // 铃铛通知API
  app.get('/api/ai/notifications', (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const notifs = getCache(`${siteKey}:notifications:unread`);
    const latest = getCache(`${siteKey}:assessment:latest`);
    res.json({ unread: notifs?.data || [], assessment: latest?.data || null });
  });
  app.post('/api/ai/notifications/read', (req, res) => {
    const siteKey = String(req.body.site || DEFAULT_SITE_KEY);
    const notifs = getCache(`${siteKey}:notifications:unread`);
    if (notifs) { notifs.data = []; setCache(`${siteKey}:notifications:unread`, [], 24 * 60 * 60_000); }
    res.json({ ok: true });
  });

  // AI 对话（SSE 流式输出）
  app.post('/api/ai/chat', async (req, res) => {
    const { messages, systemPrompt } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY 未配置' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sysParts: any[] = systemPrompt ? [{ text: systemPrompt }] : [{ text: '你是 FarmView 智能农事助手。只回答农业问题，不涉及政治，不提及模型名称。' }];
    const contents: any[] = (messages || []).map((m: any) => {
      const parts: any[] = [];
      if (m.imageBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: m.imageBase64.replace(/^data:image\/\w+;base64,/, '') } });
      }
      if (m.text) parts.push({ text: m.text });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts.length > 0 ? parts : [{ text: '' }] };
    });

    const proxyUrl = process.env.HTTPS_PROXY;
    const httpsAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
        { system_instruction: { parts: sysParts }, contents, tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 4096, temperature: 0.3 } },
        { headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' }, timeout: 120000, responseType: 'stream', httpsAgent }
      );

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter((l: string) => l.startsWith('data:'));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(5).trim());
            const token = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
          } catch {}
        }
      });
      response.data.on('end', () => { res.write('data: [DONE]\n\n'); res.end(); });
      response.data.on('error', (err: any) => {
        console.error('[AI Chat] stream error:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });
    } catch (e: any) {
      console.error('[AI Chat]', e.message);
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.end();
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

  // ── FarmMonitor 卫星数据接口 ──────────────────────

  // 获取卫星数据（?force=true 强制刷新）
  app.get('/api/farm-monitor/satellite', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const force = req.query.force === 'true';
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });

    const isSetup = !!(site.farmMonitor?.farmId && site.farmMonitor?.fieldMap);
    const isSettingUp = setupLock.has(siteKey);

    if (isSetup) {
      const today = new Date().toISOString().slice(0, 10);
      const lastFetch = lastFetchDate.get(siteKey);

      // 强制刷新或定时拉取
      if (force) {
        satelliteCache.delete(siteKey);
        try {
          await fetchSatelliteForSite(siteKey);
        } catch (e: any) {
          console.error('[FarmMonitor] 强制刷新失败:', e.message);
        }
      } else if (lastFetch !== today && isBeijing8am()) {
        fetchSatelliteForSite(siteKey).catch(e => console.error('[FarmMonitor] 轮询拉取失败:', e.message));
      }

      if (satelliteCache.has(siteKey)) {
        return res.json({ ok: true, data: satelliteCache.get(siteKey) });
      }

      // 有 setup 但无缓存：后台拉取，先返回空
      fetchSatelliteForSite(siteKey).catch(e => console.error('[FarmMonitor] 首次拉取失败:', e.message));
      return res.json({ ok: true, data: [], loading: true });
    } else if (isSettingUp) {
      res.json({ ok: true, data: [], initializing: true, message: '卫星监测服务初始化中，预计需要几分钟...' });
    } else {
      // 触发后台初始化
      ensureFarmMonitorSetup(siteKey).catch(e => console.error('[FarmMonitor] 自动初始化失败:', e.message));
      res.json({ ok: true, data: [], initializing: true, message: '正在启动卫星监测服务，请稍后刷新...' });
    }
  });

  // 检查 FarmMonitor 初始化状态
  app.get('/api/farm-monitor/status', async (req, res) => {
    const siteKey = String(req.query.site || DEFAULT_SITE_KEY);
    const site = sitesConfig.sites[siteKey];
    if (!site) return res.status(404).json({ error: '基地不存在' });

    const isSetup = !!(site.farmMonitor?.farmId && site.farmMonitor?.fieldMap);
    const isSettingUp = setupLock.has(siteKey);
    const fieldCount = isSetup ? Object.keys(site.farmMonitor!.fieldMap!).length : 0;

    res.json({
      ok: true,
      setup: isSetup,
      initializing: isSettingUp,
      fieldCount,
      lastFetch: lastFetchDate.get(siteKey) || null,
      recordCount: (satelliteCache.get(siteKey) || []).length,
    });
  });

  // 定时轮询：每小时检查，北京时间 8:00-8:59 拉取
  const DAILY_POLL_INTERVAL = setInterval(async () => {
    if (!isBeijing8am()) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const siteKey of Object.keys(sitesConfig.sites)) {
      const site = sitesConfig.sites[siteKey];
      if (!site.farmMonitor?.farmId) continue;
      if (lastFetchDate.get(siteKey) === today) continue;
      try {
        await fetchSatelliteForSite(siteKey);
      } catch (e: any) {
        console.error(`[FarmMonitor] 定时拉取 ${siteKey} 失败:`, e.message);
      }
    }
  }, 60 * 60 * 1000);

  // 进程退出时清理
  process.on('SIGTERM', () => clearInterval(DAILY_POLL_INTERVAL));
  process.on('SIGINT', () => clearInterval(DAILY_POLL_INTERVAL));

  // --- 代理中间件：转发所有 /api/* 到后端（含缓存） ---
  app.use('/api', async (req, res) => {
    const siteKey = String(req.headers['x-site-name'] || DEFAULT_SITE_KEY);
    const method = req.method;
    const targetPath = req.url;

    // 获取路径中的关键标识用于 TTL 匹配
    const ttlKey = Object.keys(CACHE_TTL).find(k => targetPath.includes(k)) || 'default';
    const ttl = CACHE_TTL[ttlKey] || CACHE_TTL.default;
    const ck = cacheKey(siteKey, method, targetPath, req.body);

    // 检查缓存
    if (method === 'GET' || method === 'POST') {
      const cached = getCache(ck);
      if (cached) {
        console.log(`[Cache] HIT ${targetPath}`);
        return res.json(cached.data);
      }
    }

    let token: string;
    try {
      token = await getTokenForSite(siteKey);
    } catch (e: any) {
      console.error('[Proxy] 获取 Token 失败:', e.message);
      return res.status(500).json({ error: '认证失败', detail: e.message });
    }

    const targetUrl = `${API_BASE}${targetPath}`;
    const requestBody = req.body;

    // count 模式：代理内部渐进扩大时间范围，不用客户端关心天数
    if (targetPath.includes('getEnvInformationNew') && requestBody?.count && !requestBody?.startTime) {
      const end = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const steps = [3, 200];
      const count = requestBody.count;
      const { count: _c, ...baseBody } = requestBody;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      for (const days of steps) {
        const start = new Date(Date.now() - days * 86400000).toISOString().replace('T', ' ').slice(0, 19);
        console.log(`[Proxy] count=${count} 尝试 ${days}天范围`);
        let stepRes: any;
        try {
          stepRes = await axios({
            method: 'POST',
            url: targetUrl,
            headers,
            data: { ...baseBody, startTime: start, endTime: end },
            timeout: 120000,
            validateStatus: () => true,
          });
          if (stepRes.data?.code === 200 && stepRes.data?.data) {
            const hasData = Object.values(stepRes.data.data).some(
              (v: any) => Array.isArray(v) && v.length > 0
            );
            if (hasData) {
              stepRes.data.data = thinEnvData(stepRes.data.data, count);
              setCache(ck, stepRes.data, ttl);
              console.log(`[Cache] SET count=${count} ${targetPath} (TTL=${ttl / 1000}s)`);
              return res.json(stepRes.data);
            }
          }
        } catch (_) { /* 继续下一档 */ }
        // token 失效处理
        if (stepRes && (stepRes.status === 401 || stepRes.data?.code === 11009)) {
          tokenCache.delete(siteKey);
          token = await getTokenForSite(siteKey);
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      // 所有范围都无数据
      return res.json({ code: 200, msg: '操作成功', data: null });
    }

    console.log(`[Proxy] ${method} ${targetUrl}`);

    try {
      const response = await axios({
        method: method as any,
        url: targetUrl,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        data: ['POST', 'PUT', 'PATCH'].includes(method) ? requestBody : undefined,
        timeout: 60000,
        validateStatus: () => true,
      });

      // token 失效时自动重新登录并重试一次
      if (response.status === 401 || response.data?.code === 11009) {
        console.warn(`[Proxy] Token 失效，为基地 ${siteKey} 重新登录后重试`);
        tokenCache.delete(siteKey);
        token = await getTokenForSite(siteKey);
        const retry = await axios({
          method: method as any,
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          data: ['POST', 'PUT', 'PATCH'].includes(method) ? req.body : undefined,
          timeout: 60000,
          validateStatus: () => true,
        });
        if (retry.data?.code === 200 && retry.data?.data) {
          // 瘦身气象大数据
          if (targetPath.includes('getEnvInformationNew') && retry.data.data) {
            retry.data.data = thinEnvData(retry.data.data);
          }
          setCache(ck, retry.data, ttl);
        }
        return res.status(retry.status).json(retry.data);
      }

      // 瘦身 + 缓存成功响应
      let responseData = response.data;
      if (response.data?.code === 200 && response.data?.data) {
        if (targetPath.includes('getEnvInformationNew')) {
          responseData = { ...response.data, data: thinEnvData(response.data.data) };
          // 只有查到实际数据才缓存，避免空结果污染后续不同时间范围的查询
          const hasData = Object.values(responseData.data).some(
            (v: any) => Array.isArray(v) && v.length > 0
          );
          if (hasData) {
            setCache(ck, responseData, ttl);
            console.log(`[Cache] SET ${targetPath} (TTL=${ttl / 1000}s)`);
          }
        } else {
          setCache(ck, responseData, ttl);
          console.log(`[Cache] SET ${targetPath} (TTL=${ttl / 1000}s)`);
        }
      }

      res.status(response.status).json(responseData);
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

  // 启动后异步预加载所有基地数据
  for (const [siteKey, site] of Object.entries(sitesConfig.sites) as [string, any][]) {
    if (site.apiAuth && site.baseId) {
      prewarmCache(siteKey, site.apiAuth.username, site.apiAuth.password, site.baseId, site.farmlandIds || []);
    }
  }
}

startServer();
