import axios from 'axios';

const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'default-site';
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'default-device';

const api = axios.create({
  baseURL: '/cpca-api',
  timeout: 10000,
  headers: {
    'X-Site-Name': SITE_NAME,
    'X-Device-Id': DEVICE_ID,
  }
});

api.interceptors.request.use((config) => {
  // 优先使用后端代理注入的 token，如果需要前端注入，保留此逻辑
  const token = localStorage.getItem('cpca_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const login = async (data: any) => {
  const response = await api.post('/auth/login', { ...data, siteName: SITE_NAME });
  return response.data;
};

export const getFarmlandList = async (baseId: number) => {
  const response = await api.get(`/farm/land/list?baseId=${baseId}&deviceId=${DEVICE_ID}`);
  return response.data;
};

export const getGrowthData = async (data: any) => {
  const response = await api.post('/center/base/growsHight', { ...data, deviceId: DEVICE_ID });
  return response.data;
};
