import api from './api';

export const dashboardService = {
  stats: () => api.get('/dashboard/stats').then((r) => r.data),

  revenue: (params) =>
    api.get('/dashboard/revenue', { params }).then((r) => r.data),

  customers: (params) =>
    api.get('/dashboard/customers', { params }).then((r) => r.data),

  vouchers: (params) =>
    api.get('/dashboard/vouchers', { params }).then((r) => r.data),
};

export default dashboardService;
