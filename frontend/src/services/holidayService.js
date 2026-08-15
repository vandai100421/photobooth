import api from './api';

export const holidayService = {
  list: (params) => api.get('/holidays', { params }).then((r) => r.data),

  detail: (id) => api.get(`/holidays/${id}`).then((r) => r.data),

  create: (data) => api.post('/holidays', data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/holidays/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/holidays/${id}`).then((r) => r.data),
};

export default holidayService;
