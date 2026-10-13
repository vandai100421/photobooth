import api from './api';

export const boothService = {
  accounts: () => api.get('/booth/accounts').then((r) => r.data),

  saveAccount: (system, data) =>
    api.put(`/booth/accounts/${system}`, data).then((r) => r.data),

  login: (system, data) =>
    api.post(`/booth/accounts/${system}/login`, data).then((r) => r.data),

  packages: (system) =>
    api.get(`/booth/${system}/packages`).then((r) => r.data),

  sync: (system, data) =>
    api.post(`/booth/${system}/sync`, data).then((r) => r.data),

  codes: (system, params) =>
    api.get(`/booth/${system}/codes`, { params }).then((r) => r.data),

  sessions: (system, params) =>
    api.get(`/booth/${system}/sessions`, { params }).then((r) => r.data),

  createCode: (system, data) =>
    api.post(`/booth/${system}/codes`, data).then((r) => r.data),

  saveCodeReview: (system, code, data) =>
    api
      .put(`/booth/${system}/codes/${encodeURIComponent(code)}/review`, data)
      .then((r) => r.data),

  summary: (system, params) =>
    api.get(`/booth/${system}/summary`, { params }).then((r) => r.data),

  revenue: (system, params) =>
    api.get(`/booth/${system}/revenue`, { params }).then((r) => r.data),

  ledger: (system, params) =>
    api.get(`/booth/${system}/ledger`, { params }).then((r) => r.data),

  reconciliations: (system, params) =>
    api.get(`/booth/${system}/reconciliations`, { params }).then((r) => r.data),

  saveReconciliation: (system, data) =>
    api.post(`/booth/${system}/reconciliations`, data).then((r) => r.data),

  removeReconciliation: (system, id) =>
    api.delete(`/booth/${system}/reconciliations/${id}`),
};

export default boothService;
