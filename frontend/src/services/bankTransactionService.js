import api from './api';

export const bankTransactionService = {
  list: (params) =>
    api.get('/bank-transactions', { params }).then((r) => r.data),

  latest: () => api.get('/bank-transactions/latest').then((r) => r.data),
};

export default bankTransactionService;
