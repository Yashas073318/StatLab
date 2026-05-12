import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err?.response?.data?.message || err.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;
