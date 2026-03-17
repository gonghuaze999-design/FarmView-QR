import axios from 'axios';

const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'default-site';
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'default-device';

const api = axios.create({
  baseURL: '/api/cpca',
  timeout: 10000,
  headers: {
    'X-Site-Name': SITE_NAME,
    'X-Device-Id': DEVICE_ID,
  }
});

export const getFarmlandList = async (baseId: number) => {
  const response = await api.get(`/farm/land/list?baseId=${baseId}`);
  return response.data;
};

export const getIotLocations = async (baseId: number) => {
  const response = await api.get(`/collect/iot/locationList?baseId=${baseId}`);
  return response.data;
};

export const getEnvData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/collect/iot/getEnvInformationNew', {
    farmlandId,
    dimension: 'air_temperature,air_humidity',
    startTime,
    endTime
  });
  return response.data;
};

export const getInsectData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/collect/iot/insectQuantity', {
    farmlandId,
    startTime,
    endTime
  });
  return response.data;
};

export const getCameraList = async (baseId: number, farmlandIds: string) => {
  const response = await api.post('/collect/collection/cameraList', {
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
    jobType: "0"
  });
  return response.data;
};

export const getGrowthData = async (farmlandId: number, startTime: string, endTime: string) => {
  const response = await api.post('/center/base/growsHight', { 
    dimension: "Growth_status",
    farmlandId,
    startTime,
    endTime
  });
  return response.data;
};
