import api from './api';

export const voucherService = {
  list: (params) => api.get('/vouchers', { params }).then((r) => r.data),

  detail: (id) => api.get(`/vouchers/${id}`).then((r) => r.data),

  create: (data) => api.post('/vouchers', data).then((r) => r.data),

  update: (id, data) => api.put(`/vouchers/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/vouchers/${id}`).then((r) => r.data),

  check: (code) =>
    api.get('/vouchers/check', { params: { code } }).then((r) => r.data),

  issue: (id, data) =>
    api.post(`/vouchers/${id}/issue`, data).then((r) => r.data),

  usage: (id, params) =>
    api.get(`/vouchers/${id}/usage`, { params }).then((r) => r.data),
};

export default voucherService;
