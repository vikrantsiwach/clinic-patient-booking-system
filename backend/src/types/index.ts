export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  name?: string;
  role: 'patient' | 'receptionist' | 'doctor' | 'admin';
  doctorId?: string;
}

export interface Session {
  from: string;
  to: string;
  slot?: number;
  max?: number;
}

export interface ScheduleRow {
  sessions_json: Session[];
  slot_duration_mins: number;
  max_appointments: number;
}

export interface AppointmentCore {
  id: string;
  referenceCode: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: string;
  tokenNumber: number;
  sessionIndex: number;
}

export interface SlotOption {
  date: string;
  time: string;
}

export interface SmsResult {
  success: boolean;
  messageId: string;
  mock?: boolean;
  raw?: unknown;
}

// Augment Express.Request with typed user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
