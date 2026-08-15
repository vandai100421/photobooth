import api from './api';

export const uploadService = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};

export default uploadService;
