import axios from 'axios';
import { getTenantToken, clearTenantToken } from './tenantAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Separate axios instance from lib/api.ts's `api` — different auth token,
// different 401 destination (/portal/login, not /login), and tenant-portal
// endpoints aren't subject to the org trial/subscription gate at all, so
// there's no 402 handling needed here.
export const tenantApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

tenantApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getTenantToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

tenantApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/portal/login') {
      clearTenantToken();
      window.location.href = '/portal/login';
    }
    return Promise.reject(error);
  }
);

export const tenantPortal = {
  login: (email: string, password: string) => tenantApi.post('/tenant-portal/login', { email, password }),
  activate: (token: string, password: string) => tenantApi.post('/tenant-portal/activate', { token, password }),
  me: () => tenantApi.get('/tenant-portal/me'),
  payments: () => tenantApi.get('/tenant-portal/payments'),
  payNow: (paymentId: string) => tenantApi.post(`/tenant-portal/payments/${paymentId}/checkout`),
  maintenanceList: () => tenantApi.get('/tenant-portal/maintenance'),
  maintenanceCreate: (data: { title: string; description: string; category: string; priority: string }) =>
    tenantApi.post('/tenant-portal/maintenance', data),
};
