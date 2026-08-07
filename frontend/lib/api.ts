import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Auto-attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 (bad/expired token) and 402 (trial ended, no active subscription)
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    if (error.response?.status === 402 && typeof window !== 'undefined' && window.location.pathname !== '/pricing') {
      window.location.href = '/pricing?trialEnded=1';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  signup: (data: any) => api.post('/auth/signup', data),
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateLanguage: (language: string) => api.patch('/auth/organization/language', { language }),
  updateTheme: (theme: string) => api.patch('/auth/organization/theme', { theme }),
  updateOrganization: (data: any) => api.patch('/auth/organization', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  getApiKey: () => api.get('/auth/organization/api-key'),
  regenerateApiKey: () => api.post('/auth/organization/api-key'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, new_password: string) => api.post('/auth/reset-password', { token, new_password }),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: () => api.post('/auth/resend-verification'),
  updateProfile: (data: { email?: string; first_name?: string; last_name?: string; current_password: string }) => api.patch('/auth/profile', data),
};

export const properties = {
  list: () => api.get('/properties/'),
  create: (data: any) => api.post('/properties/', data),
  get: (id: string) => api.get(`/properties/${id}`),
  update: (id: string, data: any) => api.patch(`/properties/${id}`, data),
  delete: (id: string) => api.delete(`/properties/${id}`),
  stats: () => api.get('/properties/stats/overview'),
  propertyStats: (id: string) => api.get(`/properties/${id}/stats`),
  propertyVendors: (id: string) => api.get(`/properties/${id}/vendors`),
  listUnits: (id: string) => api.get(`/properties/${id}/units`),
  createUnit: (id: string, data: any) => api.post(`/properties/${id}/units`, data),
  updateUnit: (propertyId: string, unitId: string, data: any) => api.patch(`/properties/${propertyId}/units/${unitId}`, data),
  deleteUnit: (propertyId: string, unitId: string) => api.delete(`/properties/${propertyId}/units/${unitId}`),
  importUnits: (propertyId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/properties/${propertyId}/units/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  revenueTrend: (months = 6) => api.get('/properties/stats/revenue-trend', { params: { months } }),
  unitsDetail: () => api.get('/properties/stats/units-detail'),
  aiActivity: (days = 30) => api.get('/properties/stats/ai-activity', { params: { days } }),
};

export const publicContact = {
  sendSales: (data: { name: string; email: string; company?: string; message: string }) => api.post('/contact/sales', data),
};

export const publicListings = {
  browse: (params?: { city?: string; state?: string }) => api.get('/public/listings', { params }),
  get: (propertyId: string) => api.get(`/public/listings/${propertyId}`),
  inquire: (propertyId: string, data: any) => api.post(`/public/listings/${propertyId}/inquire`, data),
};

export const inquiries = {
  list: (propertyId?: string, status?: string) => api.get('/inquiries', { params: { property_id: propertyId, status } }),
  update: (id: string, data: any) => api.patch(`/inquiries/${id}`, data),
  convertToTenant: (id: string) => api.post(`/inquiries/${id}/convert-to-tenant`),
  screen: (id: string, data: { annual_income: number; monthly_rent: number; credit_score?: number; employment_status: string; employer?: string }) =>
    api.post(`/inquiries/${id}/screen`, data),
  delete: (id: string) => api.delete(`/inquiries/${id}`),
};

export const tenants = {
  list: (propertyId?: string) => api.get('/tenants/', { params: { property_id: propertyId } }),
  create: (data: any) => api.post('/tenants/', data),
  get: (id: string) => api.get(`/tenants/${id}`),
  update: (id: string, data: any) => api.patch(`/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/tenants/${id}`),
  createLease: (data: any) => api.post('/tenants/leases', data),
  downloadContract: (leaseId: string) => api.get(`/tenants/leases/${leaseId}/contract`, { responseType: 'blob' }),
  importTenants: (file: File, propertyId?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (propertyId) form.append('property_id', propertyId);
    return api.post('/tenants/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  invite: (id: string) => api.post(`/tenant-portal/invite/${id}`),
};

export const maintenance = {
  list: (status?: string, propertyId?: string) => api.get('/maintenance/', { params: { status, property_id: propertyId } }),
  create: (data: any) => api.post('/maintenance/', data),
  update: (id: string, data: any) => api.patch(`/maintenance/${id}`, data),
  chat: (data: any) => api.post('/maintenance/ai-chat', data),
  vendors: () => api.get('/maintenance/vendors'),
};

export const voice = {
  calls: () => api.get('/voice/calls'),
};

export const leads = {
  list: (status?: string) => api.get('/leads/', { params: { status } }),
  create: (data: any) => api.post('/leads/', data),
  updateStatus: (id: string, data: any) => api.patch(`/leads/${id}/status`, data),
  sendOutreach: (id: string) => api.post(`/leads/${id}/outreach`),
  scrape: (data: any) => api.post('/leads/scrape', data),
};

export const billing = {
  plans: () => api.get('/billing/plans'),
  checkout: (plan: string) => api.post('/billing/checkout', { plan }),
  connectOnboard: () => api.post('/billing/connect/onboard'),
  connectStatus: () => api.get('/billing/connect/status'),
};

export const portfolio = {
  dashboard: () => api.get('/portfolio/dashboard'),
  exportDashboard: (format: 'csv' | 'xlsx' | 'pdf') =>
    api.get('/portfolio/dashboard/export', { params: { format }, responseType: 'blob' }),
};

export const compliance = {
  list: (propertyId?: string, category?: string) => api.get('/compliance/', { params: { property_id: propertyId, category } }),
  dashboard: () => api.get('/compliance/dashboard'),
  create: (data: any) => api.post('/compliance/', data),
  update: (id: string, data: any) => api.patch(`/compliance/${id}`, data),
  delete: (id: string) => api.delete(`/compliance/${id}`),
};

export const collections = {
  queue: (propertyId?: string) => api.get('/collections/queue', { params: { property_id: propertyId } }),
  settings: () => api.get('/collections/settings'),
  updateSettings: (data: any) => api.patch('/collections/settings', data),
  recordAction: (paymentId: string, data: any) => api.post(`/collections/${paymentId}/actions`, data),
  history: (paymentId: string) => api.get(`/collections/${paymentId}/history`),
};

export const investment = {
  analysis: () => api.get('/investment/analysis'),
};

export const documents = {
  list: (category?: string, propertyId?: string) => api.get('/documents/', { params: { category, property_id: propertyId } }),
  search: (q: string) => api.get('/documents/search', { params: { q } }),
  upload: (file: File, title: string, category: string, propertyId?: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('category', category);
    if (propertyId) form.append('property_id', propertyId);
    return api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  download: (id: string) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id: string) => api.delete(`/documents/${id}`),
  generate: (data: any) => api.post('/documents/generate', data),
  getTemplates: () => api.get('/documents/templates'),
  updateTemplates: (data: any) => api.patch('/documents/templates', data),
};

export const pricingIntel = {
  analysis: () => api.get('/pricing-intel/analysis'),
};

export const inspections = {
  list: (propertyId?: string, unitId?: string, inspectionType?: string) =>
    api.get('/inspections/', { params: { property_id: propertyId, unit_id: unitId, inspection_type: inspectionType } }),
  get: (id: string) => api.get(`/inspections/${id}`),
  create: (data: any) => api.post('/inspections/', data),
  update: (id: string, data: any) => api.patch(`/inspections/${id}`, data),
  delete: (id: string) => api.delete(`/inspections/${id}`),
  uploadPhoto: (id: string, roomArea: string, file: File) => {
    const form = new FormData();
    form.append('room_area', roomArea);
    form.append('file', file);
    return api.post(`/inspections/${id}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadReport: (id: string) => api.get(`/inspections/${id}/report`, { responseType: 'blob' }),
};

export const communications = {
  templates: () => api.get('/communications/templates'),
  list: (tenantId?: string, propertyId?: string, channel?: string) =>
    api.get('/communications/', { params: { tenant_id: tenantId, property_id: propertyId, channel } }),
  send: (data: any) => api.post('/communications/send', data),
};

export const executive = {
  suggestions: () => api.get('/executive/suggestions'),
  query: (query: string) => api.post('/executive/query', { query }),
};

export const accounting = {
  portfolioReport: () => api.get('/accounting/reports/portfolio'),
  propertyReport: (propertyId: string) => api.get(`/accounting/reports/property/${propertyId}`),
  listPayments: (propertyId?: string) => api.get('/accounting/payments', { params: { property_id: propertyId } }),
  recordPayment: (data: any) => api.post('/accounting/payments', data),
  listExpenses: (propertyId?: string) => api.get('/accounting/expenses', { params: { property_id: propertyId } }),
  recordExpense: (data: any) => api.post('/accounting/expenses', data),
  listLeases: (propertyId?: string) => api.get('/accounting/leases', { params: { property_id: propertyId } }),
  exportPortfolioReport: (format: 'csv' | 'xlsx' | 'pdf') =>
    api.get('/accounting/reports/portfolio/export', { params: { format }, responseType: 'blob' }),
  exportPropertyReport: (propertyId: string, format: 'csv' | 'xlsx' | 'pdf') =>
    api.get(`/accounting/reports/property/${propertyId}/export`, { params: { format }, responseType: 'blob' }),
};

export const admin = {
  metrics: () => api.get('/admin/metrics'),
  listOrganizations: () => api.get('/admin/organizations'),
  updateOrganization: (id: string, data: any) => api.patch(`/admin/organizations/${id}`, data),
  listUsers: () => api.get('/admin/users'),
  updateUser: (id: string, data: any) => api.patch(`/admin/users/${id}`, data),
  listMessages: () => api.get('/admin/messages'),
  replyToMessage: (id: string, reply: string) => api.post(`/admin/messages/${id}/reply`, { reply }),
  deleteMessage: (id: string) => api.delete(`/admin/messages/${id}`),
  subscribers: (search?: string, status?: string) => api.get('/admin/subscribers', { params: { search, status } }),
  revenue: () => api.get('/admin/revenue'),
  invoicesForOrg: (orgId: string) => api.get(`/admin/revenue/invoices/${orgId}`),
  growth: () => api.get('/admin/growth'),
  platformHealth: () => api.get('/admin/platform-health'),
  businessAnalytics: () => api.get('/admin/business-analytics'),
  listVerificationFiles: () => api.get('/admin/verification-files'),
  createVerificationFile: (filename: string, content: string) => api.post('/admin/verification-files', { filename, content }),
  deleteVerificationFile: (id: string) => api.delete(`/admin/verification-files/${id}`),
};

export const contact = {
  send: (subject: string, message: string) => api.post('/contact/', { subject, message }),
};

export const team = {
  list: () => api.get('/team/members'),
  invite: (data: any) => api.post('/team/members', data),
  changeRole: (userId: string, role: string) => api.patch(`/team/members/${userId}/role`, { role }),
  toggleActive: (userId: string) => api.patch(`/team/members/${userId}/deactivate`),
};

export const mfa = {
  status: () => api.get('/auth/mfa/status'),
  setup: () => api.post('/auth/mfa/setup'),
  verify: (code: string) => api.post('/auth/mfa/verify', { code }),
  disable: (password: string, code: string) => api.post('/auth/mfa/disable', { password, code }),
  loginVerify: (mfaToken: string, code: string) => api.post('/auth/mfa/login-verify', { mfa_token: mfaToken, code }),
};

export const oauth = {
  googleConfig: () => api.get('/auth/oauth/google/config'),
  googleLoginUrl: () => `${API_URL}/auth/oauth/google/login`,
};

export const fraud = {
  scan: () => api.get('/fraud/scan'),
};

export const predictive = {
  maintenanceRisk: () => api.get('/predictive/maintenance-risk'),
  renewalRisk: () => api.get('/predictive/renewal-risk'),
};

export const workflows = {
  metadata: () => api.get('/workflows/metadata'),
  list: () => api.get('/workflows/'),
  create: (data: any) => api.post('/workflows/', data),
  update: (id: string, data: any) => api.patch(`/workflows/${id}`, data),
  delete: (id: string) => api.delete(`/workflows/${id}`),
  test: (id: string, sampleData: any) => api.post(`/workflows/${id}/test`, { sample_data: sampleData }),
};
