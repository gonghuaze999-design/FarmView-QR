import axios from 'axios';

const api = axios.create({ timeout: 15000 });

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
    dimension: 'air_temperature,air_humidity,light_intensity',
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
export const getFarmWorkList = async (baseId: number, startTime: string, endTime: string) => {
  const res = await api.get(
    `/api/farm/work/list?baseId=${baseId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&pageNum=1&pageSize=100`
  );
  return res.data;
};

export const getFarmWorkTaskCount = async (baseId: number, startTime: string, endTime: string) => {
  const res = await api.get(
    `/api/farm/work/taskCount?baseId=${baseId}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
  );
  return res.data;
};

// ── 农情监测（无人机 NDVI）────────────────────────────
export const getCompleteTaskList = async (baseId: number) => {
  const res = await api.get(`/api/center/base/queryCompleteTaskList?baseId=${baseId}`);
  return res.data;
};

export const getAlgorithmResult = async (taskId: number | string) => {
  const res = await api.post(`/api/center/base/queryPhotoAlgorithmTaskInfo?taskId=${taskId}`);
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
