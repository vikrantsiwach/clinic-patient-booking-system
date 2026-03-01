import { create } from 'zustand';

interface SessionInfo {
  index: number;
  label: string;
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
}

interface PatientDetails {
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | '';
  dob: string;
  email: string;
  heightCm: string;
  weightKg: string;
  reason: string;
  consent: boolean;
}

interface ConfirmedAppointment {
  referenceCode: string;
  token: number;
  sessionIndex: number;
}

interface DoctorInfo {
  id: string;
  displayName: string;
  specialization: string;
  qualifications?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
}

interface ClinicInfoState {
  clinicName?: string;
  doctors?: DoctorInfo[];
  missedCallNumber?: string | null;
  [key: string]: unknown;
}

interface BookingState {
  selectedDoctor: DoctorInfo | null;
  selectedSession: SessionInfo | null;
  patientDetails: PatientDetails;
  confirmedAppointment: ConfirmedAppointment | null;
  channel: 'online' | 'missed_call' | 'returning';
  clinicInfo: ClinicInfoState | null;

  setChannel: (channel: BookingState['channel']) => void;
  setSelectedDoctor: (doctor: DoctorInfo | null) => void;
  setSelectedSession: (session: SessionInfo | null) => void;
  setPatientDetails: (details: Partial<PatientDetails>) => void;
  setConfirmedAppointment: (appt: ConfirmedAppointment | null) => void;
  setClinicInfo: (info: ClinicInfoState | null) => void;
  reset: () => void;
}

const useBookingStore = create<BookingState>((set) => ({
  selectedDoctor: null,
  selectedSession: null,
  patientDetails: {
    name: '',
    phone: '',
    gender: '',
    dob: '',
    email: '',
    heightCm: '',
    weightKg: '',
    reason: '',
    consent: false,
  },
  confirmedAppointment: null,
  channel: 'online',
  clinicInfo: null,

  setChannel: (channel) => set({ channel }),
  setSelectedDoctor: (doctor) => set({ selectedDoctor: doctor }),
  setSelectedSession: (session) => set({ selectedSession: session }),
  setPatientDetails: (details) => set((s) => ({ patientDetails: { ...s.patientDetails, ...details } })),
  setConfirmedAppointment: (appt) => set({ confirmedAppointment: appt }),
  setClinicInfo: (info) => set({ clinicInfo: info }),

  reset: () => set({
    selectedDoctor: null,
    selectedSession: null,
    patientDetails: { name: '', phone: '', gender: '', dob: '', email: '', heightCm: '', weightKg: '', reason: '', consent: false },
    confirmedAppointment: null,
  }),
}));

export default useBookingStore;
export type { SessionInfo, PatientDetails, ConfirmedAppointment, ClinicInfoState, DoctorInfo };
