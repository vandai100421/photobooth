import api from './api';

export const scheduleService = {
  listShifts: (params) =>
    api.get('/schedule/shifts', { params }).then((r) => r.data),

  workload: (params) =>
    api.get('/schedule/workload', { params }).then((r) => r.data),

  autoAssign: (params) =>
    api.get('/schedule/auto-assign', { params }).then((r) => r.data),

  createShift: (data) =>
    api.post('/schedule/shifts', data).then((r) => r.data),

  updateShift: (id, data) =>
    api.put(`/schedule/shifts/${id}`, data).then((r) => r.data),

  removeShift: (id) =>
    api.delete(`/schedule/shifts/${id}`).then((r) => r.data),

  listSwapRequests: (params) =>
    api.get('/schedule/swap-requests', { params }).then((r) => r.data),

  createSwapRequest: (data) =>
    api.post('/schedule/swap-requests', data).then((r) => r.data),

  reviewSwapRequest: (id, data) =>
    api.put(`/schedule/swap-requests/${id}/review`, data).then((r) => r.data),

  listLocations: (params) =>
    api.get('/schedule/locations', { params }).then((r) => r.data),

  createLocation: (data) =>
    api.post('/schedule/locations', data).then((r) => r.data),

  updateLocation: (id, data) =>
    api.put(`/schedule/locations/${id}`, data).then((r) => r.data),

  removeLocation: (id) =>
    api.delete(`/schedule/locations/${id}`).then((r) => r.data),
};

export default scheduleService;
