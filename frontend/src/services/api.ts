import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      ['token','userRole','userName','doctorId','userPhoto'].forEach(k => localStorage.removeItem(k));
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Public
export const getClinicInfo = () => api.get('/clinic/info');
export const getTodayQueue = (doctorId: string) => api.get(`/queue/today?doctorId=${encodeURIComponent(doctorId)}`);
export const getQueuePosition = (refCode: string) => api.get(`/queue/position/${encodeURIComponent(refCode)}`);
export const createAppointment = (data: Record<string, unknown>) => api.post('/appointments', data);

// Patient auth
export const sendOtp = (phone: string) => api.post('/auth/patient/otp/send', { phone });
export const verifyOtp = (phone: string, otp: string) => api.post('/auth/patient/otp/verify', { phone, otp });

// Patient
export const getMyAppointments = () => api.get('/patient/appointments');
export const cancelMyAppointment = (id: string, reason: string) => api.patch(`/patient/appointments/${id}/cancel`, { cancellationReason: reason });

// Staff auth
export const staffLogin = (email: string, password: string) => api.post('/auth/staff/login', { email, password });

// Staff profile
export const getMyProfile = () => api.get('/staff/me');
export const updateMyProfile = (data: Record<string, unknown>) => api.patch('/staff/me', data);
export const changePassword = (data: Record<string, unknown>) => api.patch('/staff/me/password', data);

// Staff
export const getAppointments = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, v); });
  const qs = q.toString();
  return api.get(`/staff/appointments${qs ? `?${qs}` : ''}`);
};
export const checkPatientDuplicate = (phone: string, doctorId?: string) =>
  api.get(`/staff/appointments/check-duplicate?phone=${encodeURIComponent(phone)}${doctorId ? `&doctorId=${doctorId}` : ''}`);
export const getAppointmentById = (id: string) => api.get(`/staff/appointments/${id}`);
export const updateAppointmentStatus = (id: string, status: string, cancellationReason?: string) => api.patch(`/staff/appointments/${id}/status`, { status, cancellationReason });
export const addDoctorNotes = (id: string, doctorNotes: string) => api.patch(`/staff/appointments/${id}/notes`, { doctorNotes });
export const createWalkIn = (data: Record<string, unknown>) => api.post('/staff/appointments', data);
export const createEmergency = (data: Record<string, unknown>) => api.post('/staff/queue/emergency', data);
export const searchPatients = (q: string) => api.get(`/staff/patients/search?q=${encodeURIComponent(q)}`);

// Admin / Staff shared
export const getDoctors = () => api.get('/admin/doctors');
export const getReports = (from?: string, to?: string, doctorId?: string) => {
  const q = new URLSearchParams();
  if (from) { q.set('from', from); q.set('to', to!); }
  if (doctorId) q.set('doctorId', doctorId);
  const qs = q.toString();
  return api.get(`/admin/reports${qs ? `?${qs}` : ''}`);
};
export const getSchedule = (doctorId?: string) => api.get(`/admin/schedule${doctorId ? `?doctorId=${doctorId}` : ''}`);
export const updateSchedule = (days: Record<string, unknown>[], doctorId?: string) => api.put('/admin/schedule', { days, ...(doctorId ? { doctorId } : {}) });
export const getBlockedDates = (doctorId?: string) => api.get(`/admin/blocked-dates${doctorId ? `?doctorId=${doctorId}` : ''}`);
export const addBlockedDate = (data: Record<string, unknown>) => api.post('/admin/blocked-dates', data);
export const removeBlockedDate = (id: string) => api.delete(`/admin/blocked-dates/${id}`);
export const listStaff = (status?: string) => api.get(`/admin/staff${status ? `?status=${status}` : ''}`);
export const createStaff = (data: Record<string, unknown>) => api.post('/admin/staff', data);
export const updateStaffStatus = (id: string, status: string) => api.patch(`/admin/staff/${id}/status`, { status });
export const updateStaffDetails = (id: string, data: Record<string, unknown>) => api.patch(`/admin/staff/${id}`, data);
export const getClinicSettings = () => api.get('/admin/clinic-settings');
export const updateClinicSettings = (data: Record<string, unknown>) => api.patch('/admin/clinic-settings', data);
export const getDoctorProfile = () => api.get('/admin/doctor');
export const updateDoctorProfile = (data: Record<string, unknown>) => api.patch('/admin/doctor', data);
export const getMCAnalytics = (from?: string, to?: string) => api.get(`/admin/missed-call/analytics${from ? `?from=${from}&to=${to}` : ''}`);
export const updateMCConfig = (data: Record<string, unknown>) => api.put('/admin/missed-call/config', data);
export const addToBlacklist = (data: Record<string, unknown>) => api.post('/admin/missed-call/blacklist', data);
export const removeFromBlacklist = (phone: string) => api.delete(`/admin/missed-call/blacklist/${encodeURIComponent(phone)}`);

export default api;
