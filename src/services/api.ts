import axios from 'axios';

const api = axios.create({
  timeout: 10000,
});

// 请求拦截器，动态注入当前站点的标识
api.interceptors.request.use((config) => {
  const searchParams = new URLSearchParams(window.location.search);
  const siteKey = searchParams.get('site') || 'base-current';
  config.headers['X-Site-Name'] = siteKey;
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
  return config;
}, (error) => {
  console.error('[API Request Error]', error);
  return Promise.reject(error);
});

// 响应拦截器，添加日志
api.interceptors.response.use((response) => {
  console.log(`[API Response] ${response.config.url}`, response.data);
  return response;
}, (error) => {
  console.error('[API Response Error]', error);
  return Promise.reject(error);
});

export const getFarmlandList = async (baseId: number) => {
  const response = await api.get(`/api/farm/land/list?baseId=${baseId}`);
  return response.data;
};

export const getIotLocations = async (baseId: number) => {
  const response = await api.get(`/api/collect/iot/locationList?baseId=${baseId}`);
  return response.data;
};

export const getEnvData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/api/collect/iot/getEnvInformationNew', {
    farmlandId,
    dimension: 'air_temperature,air_humidity',
    startTime,
    endTime
  });
  return response.data;
};

export const getInsectData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/api/collect/iot/insectQuantity', {
    farmlandId,
    startTime,
    endTime
  });
  return response.data;
};

export const getCameraList = async (baseId: number, farmlandIds: string) => {
  const response = await api.post('/api/collect/collection/cameraList', {
    baseId,
    farmlandIds
  });
  return response.data;
};

export const getMachineTasks = async (farmId: number) => {
  const response = await api.post('/api/dataCenter/machineList', {
    farmId,
    pageNo: 1,
    pageSize: 100,
    jobType: "0",
    dimension: "TE" // 补全必填参数
  });
  return response.data;
};

export const getGrowthData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/api/center/base/growsHight', { 
    dimension: "Growth_status",
    farmlandId,
    startTime,
    endTime
  });
  return response.data;
};
