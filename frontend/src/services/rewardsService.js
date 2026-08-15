import api from './api';

export const rewardsService = {
  kpi: (params) => api.get('/rewards/kpi', { params }).then((r) => r.data),

  leaderboard: (params) =>
    api.get('/rewards/leaderboard', { params }).then((r) => r.data),

  listBonusRules: () =>
    api.get('/rewards/bonus-rules').then((r) => r.data),

  upsertBonusRules: (rules) =>
    api.put('/rewards/bonus-rules', { rules }).then((r) => r.data),

  listPayouts: (params) =>
    api.get('/rewards/payouts', { params }).then((r) => r.data),

  createPayout: (data) =>
    api.post('/rewards/payouts', data).then((r) => r.data),

  updatePayout: (id, data) =>
    api.put(`/rewards/payouts/${id}`, data).then((r) => r.data),

  listFeedback: (params) =>
    api.get('/rewards/feedback', { params }).then((r) => r.data),

  createFeedback: (data) =>
    api.post('/rewards/feedback', data).then((r) => r.data),
};

export default rewardsService;
