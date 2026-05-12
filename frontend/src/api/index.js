import axiosInstance from './axiosInstance';

export const datasetsApi = {
  upload: (formData) => axiosInstance.post('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: (page = 1, limit = 10) => axiosInstance.get('/datasets', { params: { page, limit } }),
  preview: (id, page = 1) => axiosInstance.get(`/datasets/${id}/preview`, { params: { page } }),
  profile: (id) => axiosInstance.get(`/datasets/${id}/profile`),
  remove: (id) => axiosInstance.delete(`/datasets/${id}`),
};

export const cleanApi = {
  nullMap: (id) => axiosInstance.get(`/datasets/${id}/nulls`),
  impute: (payload) => axiosInstance.post('/clean/impute', payload),
  normalize: (payload) => axiosInstance.post('/clean/normalize', payload),
  denormalize: (payload) => axiosInstance.post('/clean/denormalize', payload),
  outliers: (payload) => axiosInstance.post('/clean/outliers', payload),
  diff: (id) => axiosInstance.get(`/clean/${id}/diff`),
};

export const statsApi = {
  boxplot: (datasetId) => axiosInstance.get(`/stats/boxplot/${datasetId}`),
  boxplotGrouped: (params) => axiosInstance.get('/stats/boxplot/grouped', { params }),
  ttestPaired: (payload) => axiosInstance.post('/stats/ttest/paired', payload),
  tDistribution: (params) => axiosInstance.get('/stats/tdistribution', { params }),
  correlationPearson: (payload) => axiosInstance.post('/stats/correlation/pearson', payload),
  correlationMatrix: (payload) => axiosInstance.post('/stats/correlation/matrix', payload),
  scatter: (params) => axiosInstance.get('/stats/scatter', { params }),
  correlationSpearman: (payload) => axiosInstance.post('/stats/correlation/spearman', payload),
  correlationCompare: (params) => axiosInstance.get('/stats/correlation/compare', { params }),
  correlationSynthetic: (payload) => axiosInstance.post('/stats/correlation/synthetic', payload),
  correlationGallery: () => axiosInstance.get('/stats/correlation/gallery'),
  regressionSimple: (payload) => axiosInstance.post('/stats/regression/simple', payload),
  regressionPredict: (payload) => axiosInstance.post('/stats/regression/predict', payload),
  regressionMultiple: (payload) => axiosInstance.post('/stats/regression/multiple', payload),
  regressionPredictMultiple: (payload) => axiosInstance.post('/stats/regression/predict/multiple', payload),
  regressionStepwise: (payload) => axiosInstance.post('/stats/regression/stepwise', payload),
  analyses: (type) => axiosInstance.get('/analyses', { params: { type } }),
};
