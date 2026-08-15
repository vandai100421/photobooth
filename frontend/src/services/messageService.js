import api from './api';

export const messageService = {
  logs: (params) =>
    api.get('/messages/logs', { params }).then((r) => r.data),

  sendNow: (data) =>
    api.post('/messages/send-now', data).then((r) => r.data),

  scheduled: (params) =>
    api.get('/messages/scheduled', { params }).then((r) => r.data),

  schedule: (data) =>
    api.post('/messages/schedule', data).then((r) => r.data),

  stats: (params) =>
    api.get('/messages/stats', { params }).then((r) => r.data),
};

export default messageService;
