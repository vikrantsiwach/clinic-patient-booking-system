import { Router, Request, Response } from 'express';
import { publicLimiter, otpSendLimiter, loginLimiter } from '../middleware/rateLimiter';
import { verifyToken, requireStaff, requireAdmin, requirePatient, requireDoctorOrAdmin } from '../middleware/auth';
import { validate, schemas } from '../middleware/validate';
import { hmacVerify } from '../middleware/hmacVerify';
import { sendPendingNotifications } from '../services/notification';
import { expireOldSessions, cleanupRateLimits } from '../services/spamFilter';

// Controllers
import * as clinic from '../controllers/clinic';
import * as queue from '../controllers/queue';
import * as appointments from '../controllers/appointments';
import * as auth from '../controllers/auth';
import * as patient from '../controllers/patient';
import * as staff from '../controllers/staff';
import * as admin from '../controllers/admin';
import * as missedCall from '../controllers/missedCall';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/clinic/info', publicLimiter, clinic.getClinicInfo);
router.get('/queue/today', publicLimiter, queue.getTodayQueue);
router.get('/queue/position/:refCode', publicLimiter, queue.getQueuePosition);
router.post('/appointments', publicLimiter, validate(schemas.createAppointment), appointments.createAppointment);

// ── Patient Auth ──────────────────────────────────────────────────────────────
router.post('/auth/patient/otp/send', otpSendLimiter, validate(schemas.otpSend), auth.sendPatientOtp);
router.post('/auth/patient/otp/verify', publicLimiter, validate(schemas.otpVerify), auth.verifyPatientOtp);

// ── Patient Protected ─────────────────────────────────────────────────────────
router.get('/patient/appointments', verifyToken, requirePatient, patient.getMyAppointments);
router.patch('/patient/appointments/:id/cancel', verifyToken, requirePatient, validate(schemas.patientCancel), patient.cancelMyAppointment);

// ── Staff Auth ────────────────────────────────────────────────────────────────
router.post('/auth/staff/login', loginLimiter, validate(schemas.staffLogin), auth.staffLogin);

// ── Staff Profile ─────────────────────────────────────────────────────────────
router.get('/staff/me', verifyToken, requireStaff, staff.getMyProfile);
router.patch('/staff/me', verifyToken, requireStaff, validate(schemas.profileUpdate), staff.updateMyProfile);
router.patch('/staff/me/password', verifyToken, requireStaff, validate(schemas.passwordChange), staff.changePassword);

// ── Staff Protected ───────────────────────────────────────────────────────────
router.get('/staff/appointments/check-duplicate', verifyToken, requireStaff, staff.checkPatientDuplicate);
router.get('/staff/appointments', verifyToken, requireStaff, staff.getAppointmentsByDate);
router.get('/staff/appointments/:id', verifyToken, requireStaff, staff.getAppointmentById);
router.patch('/staff/appointments/:id/status', verifyToken, requireStaff, validate(schemas.updateStatus), staff.updateAppointmentStatus);
router.patch('/staff/appointments/:id/notes', verifyToken, requireDoctorOrAdmin, validate(schemas.doctorNotes), staff.addDoctorNotes);
router.post('/staff/appointments', verifyToken, requireStaff, validate(schemas.walkIn), staff.createWalkIn);
router.post('/staff/queue/emergency', verifyToken, requireStaff, validate(schemas.emergency), staff.createEmergency);
router.get('/staff/patients/search', verifyToken, requireStaff, staff.searchPatients);

// ── Admin / Staff Shared ───────────────────────────────────────────────────────
router.get('/admin/doctors', verifyToken, requireStaff, admin.getDoctors);
router.get('/admin/reports', verifyToken, requireStaff, admin.getReports);
router.get('/admin/schedule', verifyToken, requireStaff, admin.getSchedule);
router.put('/admin/schedule', verifyToken, requireStaff, validate(schemas.schedule), admin.updateSchedule);
router.get('/admin/blocked-dates', verifyToken, requireStaff, admin.getBlockedDates);
router.post('/admin/blocked-dates', verifyToken, requireStaff, validate(schemas.blockDate), admin.addBlockedDate);
router.delete('/admin/blocked-dates/:id', verifyToken, requireStaff, admin.removeBlockedDate);

// ── Admin Protected ───────────────────────────────────────────────────────────
router.get('/admin/clinic-settings', verifyToken, requireAdmin, admin.getClinicSettings);
router.patch('/admin/clinic-settings', verifyToken, requireAdmin, validate(schemas.clinicSettings), admin.updateClinicSettings);
router.get('/admin/doctor', verifyToken, requireAdmin, admin.getDoctorProfile);
router.patch('/admin/doctor', verifyToken, requireAdmin, validate(schemas.doctorProfile), admin.updateDoctorProfile);
router.get('/admin/staff', verifyToken, requireAdmin, admin.listStaff);
router.post('/admin/staff', verifyToken, requireAdmin, validate(schemas.createStaff), admin.createStaff);
router.patch('/admin/staff/:id', verifyToken, requireAdmin, validate(schemas.staffDetails), admin.updateStaffDetails);
router.patch('/admin/staff/:id/status', verifyToken, requireAdmin, validate(schemas.staffStatus), admin.updateStaffStatus);
router.get('/admin/missed-call/analytics', verifyToken, requireAdmin, admin.getMissedCallAnalytics);
router.put('/admin/missed-call/config', verifyToken, requireAdmin, validate(schemas.mcConfig), admin.updateMissedCallConfig);
router.post('/admin/missed-call/blacklist', verifyToken, requireAdmin, validate(schemas.blacklist), admin.addToBlacklist);
router.delete('/admin/missed-call/blacklist/:phone', verifyToken, requireAdmin, admin.removeFromBlacklist);

// ── Missed Call Webhooks (MSG91) ───────────────────────────────────────────────
router.post('/missed-call/webhook', hmacVerify, missedCall.handleMissedCall);
router.post('/missed-call/reply', hmacVerify, missedCall.handleSmsReply);

// ── Cron job endpoints (called by Vercel Cron) ─────────────────────────────────
router.post('/jobs/send-reminders', async (_req: Request, res: Response) => {
  const result = await sendPendingNotifications();
  res.json(result);
});
router.post('/jobs/expire-sessions', async (_req: Request, res: Response) => {
  const count = await expireOldSessions();
  res.json({ expired: count });
});
router.post('/jobs/cleanup-rate-limits', async (_req: Request, res: Response) => {
  const count = await cleanupRateLimits();
  res.json({ deleted: count });
});

export default router;
