import axios from 'axios';

// 获取访问令牌 (保留以防其他地方需要，但后端已自动处理)
export const getHoireToken = async () => {
  const response = await axios.get('/api/hoire/token');
  return response.data.data.token;
};

// 获取用户设备列表
export const getHoireDevices = async () => {
  const response = await axios.get(`/api/hoire/devices`);
  return response.data.data;
};

// 获取用户虫情设备列表
export const getHoireInsectDevices = async () => {
  const response = await axios.get(`/api/hoire/insect-devices`);
  return response.data.data;
};

// 获取用户摄像头设备列表
export const getHoireCameraDevices = async () => {
  const response = await axios.get(`/api/hoire/camera-devices`);
  return response.data.data;
};

// 订阅设备
export const subscribeToDevice = async (id: number, type: 'weather' | 'insect' | 'camera') => {
  const response = await axios.post('/api/hoire/subscribe', { id, type });
  return response.data;
};
