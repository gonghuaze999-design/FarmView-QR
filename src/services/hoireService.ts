import axios from 'axios';

// 获取访问令牌
export const getHoireToken = async () => {
  const response = await axios.get('/api/hoire/token');
  return response.data.data.token;
};

// 获取用户设备列表
export const getHoireDevices = async (token: string) => {
  const response = await axios.get(`/api/hoire/devices?token=${token}`);
  return response.data.data;
};

// 获取用户虫情设备列表
export const getHoireInsectDevices = async (token: string) => {
  const response = await axios.get(`/api/hoire/insect-devices?token=${token}`);
  return response.data.data;
};

// 获取用户摄像头设备列表
export const getHoireCameraDevices = async (token: string) => {
  const response = await axios.get(`/api/hoire/camera-devices?token=${token}`);
  return response.data.data;
};

// 订阅设备
export const subscribeToDevice = async (token: string, id: number, type: 'weather' | 'insect' | 'camera') => {
  const response = await axios.post('/api/hoire/subscribe', { token, id, type });
  return response.data;
};
