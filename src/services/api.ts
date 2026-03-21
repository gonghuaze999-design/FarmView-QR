import axios from 'axios';

const api = axios.create({ timeout: 30000 });

// 注入当前站点标识
api.interceptors.request.use((config) => {
  const siteKey = new URLSearchParams(window.location.search).get('site') || 'base-current';
  config.headers['X-Site-Name'] = siteKey;
  return config;
});

// ── 气象 ──────────────────────────────────────────────
export const getWeatherToday = async (baseId: number) => {
  const res = await api.get(`/api/collect/weather/today?baseId=${baseId}`);
  return res.data;
};

// ── 地块 ──────────────────────────────────────────────
export const getFarmlandList = async (baseId: number) => {
  const res = await api.get(`/api/farm/land/list?baseId=${baseId}`);
  return res.data;
};

export const getFarmlandDetail = async (landId: number | string) => {
  const res = await api.get(`/api/farm/land/query/${landId}`);
  return res.data;
};

export const getLandBatchInfo = async (landId: number | string) => {
  const res = await api.get(`/api/farm/batch/landBatchInfo?landId=${landId}`);
  return res.data;
};

// ── IoT 设备 ──────────────────────────────────────────
export const getIotLocations = async (baseId: number) => {
  const res = await api.get(`/api/collect/iot/locationList?baseId=${baseId}`);
  return res.data;
};

export const getEnvDataNow = async (farmlandId: number | string) => {
  const res = await api.post('/api/collect/iot/getEnvRecordNow', { farmlandId });
  return res.data;
};

export const getEnvData = async (farmlandId: number | string, startTime: string, endTime: string) => {
  const res = await api.post('/api/collect/iot/getEnvInformationNew', {
    farmlandId,
    dimension: 'air_temperature,air_humidity,wind_speed,precipitation',
    startTime,
    endTime,
  });
  return res.data;
};

export const getInsectData = async (farmlandId: number | string, startTime: string, endTime: string) => {
  const res = await api.post('/api/collect/iot/getInsectStatistics', { farmlandId, startTime, endTime });
  return res.data;
};

export const getCameraList = async (baseId: number, farmlandIds: string) => {
  const res = await api.post('/api/collect/collection/cameraList', { baseId, farmlandIds });
  return res.data;
};

// ── 农事行为 ──────────────────────────────────────────
export const queryWorkTask = async (
  baseId: number,
  startTime: string,
  endTime: string,
  pageNum = 1,
  pageSize = 100
) => {
  const res = await api.post('/api/farm/work/queryWorkTask', { baseId, startTime, endTime, pageNum, pageSize });
  return res.data;
};

export const getFarmWorkTaskCount = async (baseId: number, startTime: string, endTime: string) => {
  const res = await api.get(
    `/api/farm/work/taskCount?baseId=${baseId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
  );
  return res.data;
};

// ── 农情监测（无人机 + AI）────────────────────────────
export const getDroneTaskList = async (baseId: number, pageNum = 1, pageSize = 50) => {
  const res = await api.get(`/api/farm/monitor/webTaskList?baseId=${baseId}&pageNum=${pageNum}&pageSize=${pageSize}`);
  return res.data;
};

export const getAlgorithmImages = async (algorithmTaskId: string) => {
  const res = await api.get(`/api/center/base/queryPhotoAlgorithmTaskInfo?taskId=${algorithmTaskId}`);
  return res.data;
};

export const getGrowthData = async (farmlandId: number | string, startTime: string, endTime: string) => {
  const res = await api.post('/api/center/base/growsHight', {
    dimension: 'Growth_status',
    farmlandId,
    startTime,
    endTime,
  });
  return res.data;
};

// ── 图像赋色 + AI 分析（我方后端）────────────────────
export const colorizeImage = async (imageUrl: string) => {
  const res = await axios.post('/api/image-colorize', { imageUrl });
  return res.data as { ok: boolean; base64: string; stats: { mode: number; mean: number; std: number; minVal: number; maxVal: number } };
};

export interface AnalyzeContext {
  landName: string;
  cropsName?: string;
  lat?: number;
  lng?: number;
  date: string;
  imageType: string;
  ndviStats?: { mode: number; mean: number; std: number };
}

export const analyzeImage = async (base64: string, cacheKey: string, context: AnalyzeContext) => {
  const res = await axios.post('/api/ai/analyze', { base64, cacheKey, context }, { timeout: 40000 });
  return res.data as { ok: boolean; text: string; grade: '优' | '良' | '中' | '差' | '—' };
};
