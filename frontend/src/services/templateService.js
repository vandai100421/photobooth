import api from './api';

export const templateService = {
  list: (params) => api.get('/templates', { params }).then((r) => r.data),

  detail: (id) => api.get(`/templates/${id}`).then((r) => r.data),

  create: (data) => api.post('/templates', data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/templates/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/templates/${id}`).then((r) => r.data),
};

export default templateService;
