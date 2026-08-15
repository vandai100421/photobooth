import api from './api';

export const settingsService = {
  list: () => api.get('/settings').then((r) => r.data),

  update: (data) => api.put('/settings', data).then((r) => r.data),

  getZaloQR: () => api.get('/settings/zalo-qr').then((r) => r.data),
};

export default settingsService;
