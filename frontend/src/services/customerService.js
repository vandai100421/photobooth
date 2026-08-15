import api from './api';

export const customerService = {
  list: (params) => api.get('/customers', { params }).then((r) => r.data),

  detail: (id) => api.get(`/customers/${id}`).then((r) => r.data),

  create: (data) => api.post('/customers', data).then((r) => r.data),

  update: (id, data) =>
    api.put(`/customers/${id}`, data).then((r) => r.data),

  remove: (id) => api.delete(`/customers/${id}`).then((r) => r.data),

  birthdays: (range = 'today') =>
    api
      .get('/customers/birthdays', { params: { range } })
      .then((r) => r.data),

  listBookings: (id, params) =>
    api.get(`/customers/${id}/bookings`, { params }).then((r) => r.data),

  listVouchers: (id, params) =>
    api.get(`/customers/${id}/vouchers`, { params }).then((r) => r.data),
};

export default customerService;
