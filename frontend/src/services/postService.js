import api from './api';

export const postService = {
  list: (params) => api.get('/posts', { params }).then((r) => r.data),

  detail: (id) => api.get(`/posts/${id}`).then((r) => r.data),

  create: (data) => api.post('/posts', data).then((r) => r.data),

  update: (id, data) => api.put(`/posts/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/posts/${id}`).then((r) => r.data),

  publish: (id) => api.post(`/posts/${id}/publish`).then((r) => r.data),
};

export default postService;
