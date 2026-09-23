import api from './api';

export const dailyRevenueService = {
  list: (params) =>
    api.get('/daily-revenue', { params }).then((r) => r.data),

  upsert: (data) =>
    api.post('/daily-revenue', data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/daily-revenue/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/daily-revenue/${id}`),
};

export default dailyRevenueService;