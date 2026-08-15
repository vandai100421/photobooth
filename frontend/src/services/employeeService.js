import api from './api';

export const employeeService = {
  list: (params) =>
    api.get('/employees', { params }).then((r) => r.data),

  detail: (id) => api.get(`/employees/${id}`).then((r) => r.data),

  create: (data) => api.post('/employees', data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/employees/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/employees/${id}`).then((r) => r.data),

  listShifts: (employeeId, params) =>
    api.get(`/employees/${employeeId}/shifts`, { params }).then((r) => r.data),

  createShift: (employeeId, data) =>
    api.post(`/employees/${employeeId}/shifts`, data).then((r) => r.data),

  updateShift: (employeeId, shiftId, data) =>
    api
      .put(`/employees/${employeeId}/shifts/${shiftId}`, data)
      .then((r) => r.data),

  listSkills: (employeeId) =>
    api.get(`/employees/${employeeId}/skills`).then((r) => r.data),

  upsertSkill: (employeeId, data) =>
    api.post(`/employees/${employeeId}/skills`, data).then((r) => r.data),

  removeSkill: (employeeId, skillId) =>
    api.delete(`/employees/${employeeId}/skills/${skillId}`).then((r) => r.data),

  listAreas: (employeeId) =>
    api.get(`/employees/${employeeId}/areas`).then((r) => r.data),

  upsertArea: (employeeId, data) =>
    api.post(`/employees/${employeeId}/areas`, data).then((r) => r.data),

  removeArea: (employeeId, areaId) =>
    api.delete(`/employees/${employeeId}/areas/${areaId}`).then((r) => r.data),
};

export default employeeService;
