export interface Session {
  from: string;
  to: string;
  slot?: number;
  max?: number;
}

export interface SessionItem extends Session {
  index: number;
  label: string;
  fromLabel: string;
  toLabel: string;
  isOpen: boolean;
  tokenCount: number;
  maxTokens: number | null;
  isFull: boolean;
}

export interface DoctorInfo {
  id: string;
  displayName: string;
  specialization: string;
  qualifications: string;
  bio: string;
  photoUrl: string | null;
  phone: string;
  registrationNo: string | null;
}

export interface ScheduleDay {
  dayOfWeek: string;
  slotDurationMins: number;
  maxAppointments: number;
  sessions: Session[];
}

export interface ClinicInfo {
  doctor: DoctorInfo;
  schedule: ScheduleDay[];
  missedCallNumber: string | null;
}

export interface ConfirmedAppointment {
  referenceCode: string;
  token: number;
  sessionIndex: number;
}

export interface PatientDetails {
  name: string;
  phone: string;
  dob: string;
  email: string;
  reason: string;
  consent: boolean;
}
