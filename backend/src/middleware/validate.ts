import Joi from 'joi';
import { Request, Response, NextFunction, RequestHandler } from 'express';

export const validate = (
  schema: Joi.Schema,
  source: 'body' | 'query' | 'params' = 'body'
): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      res.status(400).json({ error: 'VALIDATION_ERROR', details });
      return;
    }
    (req as unknown as Record<string, unknown>)[source] = value;
    next();
  };

// Reusable schema parts
const phone = Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).required().messages({
  'string.pattern.base': 'Phone must be a valid number (E.164 preferred e.g. +919876543210)',
});

export const schemas = {
  // POST /api/appointments — token-based booking (today only, no date/slotTime)
  createAppointment: Joi.object({
    doctorId: Joi.string().uuid().required(),
    sessionIndex: Joi.number().integer().min(0).max(5).default(0),
    patientName: Joi.string().min(2).max(255).required(),
    patientPhone: phone,
    patientGender: Joi.string().valid('male', 'female', 'other').required(),
    patientDob: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null),
    patientEmail: Joi.string().email({ tlds: { allow: false } }).optional().allow('', null),
    patientHeightCm: Joi.number().integer().min(50).max(250).optional().allow(null),
    patientWeightKg: Joi.number().min(1).max(300).optional().allow(null),
    reasonForVisit: Joi.string().max(1000).optional().allow('', null),
    consent: Joi.boolean().valid(true).required().messages({ 'any.only': 'Consent is required' }),
  }),

  // POST /api/auth/patient/otp/send
  otpSend: Joi.object({ phone }),

  // POST /api/auth/patient/otp/verify
  otpVerify: Joi.object({ phone, otp: Joi.string().length(6).pattern(/^\d+$/).required() }),

  // POST /api/auth/staff/login
  staffLogin: Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().min(6).required(),
  }),

  // PATCH /api/patient/appointments/:id/cancel
  patientCancel: Joi.object({
    cancellationReason: Joi.string().max(500).optional().allow('', null),
  }),

  // PATCH /api/staff/appointments/:id/status — new flow: booked→arrived_waiting→with_doctor→completed
  updateStatus: Joi.object({
    status: Joi.string().valid('arrived_waiting', 'with_doctor', 'completed', 'cancelled', 'no_show').required(),
    cancellationReason: Joi.string().max(500).when('status', {
      is: 'cancelled', then: Joi.required(), otherwise: Joi.optional().allow('', null),
    }),
  }),

  // PATCH /api/staff/appointments/:id/reschedule
  reschedule: Joi.object({
    newDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    newSlotTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  }),

  // POST /api/staff/appointments (walk-in) — token-based
  walkIn: Joi.object({
    doctorId: Joi.string().uuid().required(),
    sessionIndex: Joi.number().integer().min(0).max(5).default(0),
    patientName: Joi.string().min(2).max(255).required(),
    patientPhone: phone,
    patientGender: Joi.string().valid('male', 'female', 'other').required(),
    patientDob: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null),
    patientEmail: Joi.string().email({ tlds: { allow: false } }).optional().allow('', null),
    patientHeightCm: Joi.number().integer().min(50).max(250).optional().allow(null),
    patientWeightKg: Joi.number().min(1).max(300).optional().allow(null),
    reasonForVisit: Joi.string().max(1000).optional().allow('', null),
  }),

  // POST /api/staff/queue/emergency — emergency token
  emergency: Joi.object({
    doctorId: Joi.string().uuid().required(),
    sessionIndex: Joi.number().integer().min(0).max(5).default(0),
    patientName: Joi.string().min(2).max(255).required(),
    patientPhone: phone,
    patientGender: Joi.string().valid('male', 'female', 'other').required(),
    patientDob: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null),
    patientEmail: Joi.string().email({ tlds: { allow: false } }).optional().allow('', null),
    patientHeightCm: Joi.number().integer().min(50).max(250).optional().allow(null),
    patientWeightKg: Joi.number().min(1).max(300).optional().allow(null),
    reasonForVisit: Joi.string().max(1000).optional().allow('', null),
  }),

  // PATCH /api/staff/appointments/:id/notes (doctor/admin only)
  doctorNotes: Joi.object({
    doctorNotes: Joi.string().max(5000).required(),
  }),

  // PUT /api/admin/schedule
  schedule: Joi.object({
    doctorId: Joi.string().uuid().optional(),
    days: Joi.array().items(Joi.object({
      dayOfWeek: Joi.string().valid('monday','tuesday','wednesday','thursday','friday','saturday','sunday').required(),
      isActive: Joi.boolean().default(true),
      sessions: Joi.array().items(Joi.object({
        from: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        to: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        slot: Joi.number().valid(10,15,20,30,45,60).default(20),
        max: Joi.number().min(1).allow(null).optional(),
      })).min(1).max(3).required(),
    })).required(),
  }),

  // POST /api/admin/blocked-dates
  blockDate: Joi.object({
    doctorId: Joi.string().uuid().optional(),
    blockDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null).optional(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null).optional(),
    reason: Joi.string().max(500).optional().allow('', null),
  }),

  // POST /api/admin/staff
  createStaff: Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().min(8).required(),
    fullName: Joi.string().min(2).max(255).required(),
    role: Joi.string().valid('admin', 'doctor', 'receptionist').required(),
  }),

  // PATCH /api/admin/staff/:id/status
  staffStatus: Joi.object({
    status: Joi.string().valid('active', 'suspended').required(),
  }),

  // PATCH /api/admin/staff/:id
  staffDetails: Joi.object({
    fullName: Joi.string().min(2).max(255).required(),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    role: Joi.string().valid('admin', 'doctor', 'receptionist').required(),
    password: Joi.string().min(8).optional().allow('', null),
    // Doctor profile fields (only sent when role='doctor')
    displayName: Joi.string().min(2).max(255).optional().allow('', null),
    specialization: Joi.string().min(2).max(255).optional().allow('', null),
    qualifications: Joi.string().max(500).optional().allow('', null),
    bio: Joi.string().max(2000).optional().allow('', null),
    photoUrl: Joi.string().uri().max(500).optional().allow('', null),
    phone: Joi.string().max(20).optional().allow('', null),
    registrationNo: Joi.string().max(100).optional().allow('', null),
  }),

  // PATCH /api/admin/doctor
  doctorProfile: Joi.object({
    displayName: Joi.string().min(2).max(255).required(),
    fullName: Joi.string().min(2).max(255).required(),
    specialization: Joi.string().min(2).max(255).required(),
    qualifications: Joi.string().max(500).optional().allow('', null),
    bio: Joi.string().max(2000).optional().allow('', null),
    photoUrl: Joi.string().uri().max(500).optional().allow('', null),
    phone: Joi.string().max(20).optional().allow('', null),
    registrationNo: Joi.string().max(100).optional().allow('', null),
  }),

  // PATCH /staff/me — own profile update
  profileUpdate: Joi.object({
    fullName: Joi.string().min(2).max(255).optional(),
    email: Joi.string().email({ tlds: { allow: false } }).optional(),
    photoUrl: Joi.string().uri().max(500).optional().allow('', null),
    phone: Joi.string().max(20).optional().allow('', null),
    // Doctor-only fields
    displayName: Joi.string().min(2).max(255).optional().allow('', null),
    specialization: Joi.string().min(2).max(255).optional().allow('', null),
    qualifications: Joi.string().max(500).optional().allow('', null),
    bio: Joi.string().max(2000).optional().allow('', null),
    registrationNo: Joi.string().max(100).optional().allow('', null),
  }),

  // PATCH /staff/me/password
  passwordChange: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),

  // PUT /api/admin/missed-call/config
  mcConfig: Joi.object({
    maxCallsPer24h: Joi.number().min(1).max(20).optional(),
    maxCallsPer7d: Joi.number().min(1).max(50).optional(),
    sessionExpiryMins: Joi.number().min(5).max(60).optional(),
    burstThreshold: Joi.number().min(5).max(100).optional(),
    systemPauseMins: Joi.number().min(5).max(120).optional(),
    newNumberDelaySecs: Joi.number().min(0).max(300).optional(),
    systemEnabled: Joi.boolean().optional(),
  }),

  // PATCH /api/admin/clinic-settings
  clinicSettings: Joi.object({
    clinicName: Joi.string().min(2).max(255).required(),
  }),

  // POST /api/admin/missed-call/blacklist
  blacklist: Joi.object({
    phone,
    reason: Joi.string().valid('manual_staff','auto_velocity','auto_repeated_spam','dnd_registry','invalid_format').required(),
    notes: Joi.string().max(500).optional().allow('', null),
    isPermanent: Joi.boolean().default(false),
    expiresAt: Joi.string().isoDate().when('isPermanent', {
      is: false, then: Joi.required(), otherwise: Joi.optional().allow(null),
    }),
  }),
};
