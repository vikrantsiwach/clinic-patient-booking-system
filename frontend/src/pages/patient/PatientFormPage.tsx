import { useNavigate } from 'react-router-dom';
import PatientShell from '../../components/layout/PatientShell';
import useBookingStore from '../../store/bookingStore';

export default function PatientFormPage() {
  const navigate = useNavigate();
  const { selectedSession, selectedDoctor, patientDetails, setPatientDetails } = useBookingStore();

  if (!selectedSession || !selectedDoctor) { navigate('/book'); return null; }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setPatientDetails({ [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value } as any);

  const canContinue = patientDetails.name.trim().length >= 2
    && /^\+?[1-9]\d{9,14}$/.test(patientDetails.phone)
    && patientDetails.gender !== ''
    && patientDetails.consent;

  return (
    <PatientShell step={1} title="Your Details" subtitle="Required fields marked *">
      {/* Session pill */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium bg-teal-light text-teal px-3 py-1.5 rounded-lg">
          {selectedDoctor.displayName} · {selectedSession.label} · {selectedSession.fromLabel}–{selectedSession.toLabel} · Today
        </span>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={patientDetails.name} onChange={set('name')} placeholder="e.g. Priya Sharma" />
        </div>
        <div>
          <label className="label">Mobile Number *</label>
          <input className="input" value={patientDetails.phone} onChange={set('phone')} placeholder="+919876543210" type="tel" />
          <p className="text-xs text-muted mt-1">Confirmation SMS will be sent to this number</p>
        </div>
        <div>
          <label className="label">Gender *</label>
          <div className="flex gap-3 mt-1">
            {(['male', 'female', 'other'] as const).map(g => (
              <label key={g} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={patientDetails.gender === g}
                  onChange={() => setPatientDetails({ gender: g })}
                  className="accent-teal w-4 h-4"
                />
                <span className="text-sm capitalize">{g}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Date of Birth</label>
          <input className="input" value={patientDetails.dob} onChange={set('dob')} type="date" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Height (cm)</label>
            <input className="input" value={patientDetails.heightCm} onChange={set('heightCm')} type="number" placeholder="e.g. 165" min={50} max={250} />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input className="input" value={patientDetails.weightKg} onChange={set('weightKg')} type="number" placeholder="e.g. 65" min={1} max={300} step="0.1" />
          </div>
        </div>
        <div>
          <label className="label">Email Address</label>
          <input className="input" value={patientDetails.email} onChange={set('email')} placeholder="optional" type="email" />
        </div>
        <div>
          <label className="label">Reason for Visit</label>
          <textarea className="input resize-none h-20" value={patientDetails.reason} onChange={set('reason')} placeholder="Brief description (optional)" />
        </div>

        {/* DPDPA Consent */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={patientDetails.consent} onChange={set('consent')} className="mt-0.5 accent-teal w-4 h-4" />
          <span className="text-xs text-muted leading-relaxed">
            I consent to the clinic collecting and using my personal data for appointment management purposes, in accordance with the <strong>Digital Personal Data Protection Act 2023 (DPDPA)</strong>. Data will not be shared with third parties.
          </span>
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={() => navigate('/book')} className="btn-ghost flex-1">← Back</button>
        <button onClick={() => navigate('/book/review')} disabled={!canContinue} className="btn-primary flex-1">Review →</button>
      </div>
    </PatientShell>
  );
}
