import axios from 'axios';

const api = axios.create({
  timeout: 10000,
});

// 请求拦截器，动态注入当前站点的标识
api.interceptors.request.use((config) => {
  const searchParams = new URLSearchParams(window.location.search);
  const siteKey = searchParams.get('site') || 'base-current';
  config.headers['X-Site-Name'] = siteKey;
  return config;
});

export const getFarmlandList = async (baseId: number) => {
  const response = await api.get(`/api/cpca/farm/land/list?baseId=${baseId}`);
  return response.data;
};

export const getIotLocations = async (baseId: number) => {
  const response = await api.get(`/api/cpca/collect/iot/locationList?baseId=${baseId}`);
  return response.data;
};

export const getEnvData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/api/cpca/collect/iot/getEnvInformationNew', {
    farmlandId,
    dimension: 'air_temperature,air_humidity',
    startTime,
    endTime
  });
  return response.data;
};

export const getInsectData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/api/cpca/collect/iot/insectQuantity', {
    farmlandId,
    startTime,
    endTime
  });
  return response.data;
};

export const getCameraList = async (baseId: number, farmlandIds: string) => {
  const response = await api.post('/api/cpca/collect/collection/cameraList', {
    baseId,
    farmlandIds
  });
  return response.data;
};

export const getMachineTasks = async (farmId: number) => {
  const response = await api.post('/api/cpca/dataCenter/machineList', {
    farmId,
    pageNo: 1,
    pageSize: 100,
    jobType: "0"
  });
  return response.data;
};

export const getGrowthData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/api/cpca/center/base/growsHight', { 
    dimension: "Growth_status",
    farmlandId,
    startTime,
    endTime
  });
  return response.data;
};
