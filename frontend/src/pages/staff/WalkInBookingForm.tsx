import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StaffShell from '../../components/layout/StaffShell';
import { getDoctors, getTodayQueue, createWalkIn, createEmergency, checkPatientDuplicate } from '../../services/api';

export default function WalkInBookingForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmergency = searchParams.get('emergency') === '1';

  const userRole   = localStorage.getItem('userRole') || 'receptionist';
  const myDoctorId = localStorage.getItem('doctorId') || '';

  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorId, setDoctorId] = useState(userRole === 'doctor' ? myDoctorId : '');
  const [sessions, setSessions] = useState<any[]>([]);
  const [form, setForm] = useState({
    sessionIndex: 0, patientName: '', patientPhone: '', patientGender: '',
    patientDob: '', patientHeightCm: '', patientWeightKg: '', reasonForVisit: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState('');
  const [doctorsLoading, setDoctorsLoading] = useState(userRole !== 'doctor');
  const [queueLoading, setQueueLoading] = useState(false);
  const [duplicate, setDuplicate] = useState<any>(null);

  // Load doctors if not doctor role
  useEffect(() => {
    if (userRole === 'doctor') return;
    getDoctors()
      .then(r => {
        const docs = r.data.doctors || [];
        setDoctors(docs);
        if (docs.length === 1) setDoctorId(docs[0].id);
        setDoctorsLoading(false);
      })
      .catch(() => setDoctorsLoading(false));
  }, [userRole]);

  // Load sessions when doctorId changes
  useEffect(() => {
    if (!doctorId) return;
    setQueueLoading(true);
    setSessions([]);
    getTodayQueue(doctorId)
      .then(r => {
        if (r.data.sessions) {
          setSessions(r.data.sessions);
          const firstOpen = r.data.sessions.find((s: any) => s.isOpen);
          if (firstOpen) setForm(f => ({ ...f, sessionIndex: firstOpen.index }));
        }
        setQueueLoading(false);
      })
      .catch(() => setQueueLoading(false));
  }, [doctorId]);

  // Duplicate check on phone change
  useEffect(() => {
    if (form.patientPhone.length < 8) { setDuplicate(null); return; }
    checkPatientDuplicate(form.patientPhone, doctorId || undefined)
      .then(r => setDuplicate(r.data.isDuplicate ? r.data.appointment : null))
      .catch(() => setDuplicate(null));
  }, [form.patientPhone, doctorId]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const fn = isEmergency ? createEmergency : createWalkIn;
      const payload = {
        doctorId,
        sessionIndex: form.sessionIndex,
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        patientGender: form.patientGender,
        patientDob: form.patientDob || undefined,
        patientHeightCm: form.patientHeightCm ? Number(form.patientHeightCm) : undefined,
        patientWeightKg: form.patientWeightKg ? Number(form.patientWeightKg) : undefined,
        reasonForVisit: form.reasonForVisit || undefined,
      };
      const res = await fn(payload);
      setSuccess({ ...res.data.appointment, isEmergency });
    } catch (err) {
      const e = (err as any).response?.data;
      if (e?.error === 'SESSION_FULL') setError('This session is full.');
      else if (e?.error === 'SESSION_CLOSED') setError('This session has ended.');
      else if (e?.error === 'CLINIC_CLOSED') setError('Clinic is closed today.');
      else setError(e?.message || 'Booking failed');
    }
    setLoading(false);
  };

  if (success) return (
    <StaffShell>
      <div className="max-w-md mx-auto card text-center py-8">
        <div className="text-5xl mb-4">{success.isEmergency ? '⚡' : '✅'}</div>
        <h3 className="font-serif text-xl mb-2">
          {success.isEmergency ? 'Emergency Token Added' : 'Walk-in Booked'}
        </h3>
        <div className={`w-24 h-24 rounded-2xl flex items-center justify-center font-bold text-4xl mx-auto mb-3
          ${success.isEmergency ? 'bg-red-100 text-red-600' : 'bg-teal-light text-teal'}`}>
          #{success.token}
        </div>
        <p className="font-mono text-sm text-muted mb-4">{success.referenceCode}</p>
        <div className="space-y-3">
          <button onClick={() => {
            setSuccess(null);
            setForm(f => ({ ...f, patientName:'',patientPhone:'',patientGender:'',patientDob:'',patientHeightCm:'',patientWeightKg:'',reasonForVisit:'' }));
          }} className="btn-primary w-full">
            {isEmergency ? '⚡ Add Another Emergency' : '+ Book Another'}
          </button>
          <button onClick={() => navigate('/staff/dashboard')} className="btn-ghost w-full">Back to Queue</button>
        </div>
      </div>
    </StaffShell>
  );

  const availableSessions = sessions.filter((s: any) => isEmergency || s.isOpen || !s.isFull);
  const showDoctorPicker = userRole !== 'doctor' && doctors.length > 1;

  return (
    <StaffShell>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {isEmergency && <span className="text-2xl">⚡</span>}
          <h2 className="font-serif text-2xl">
            {isEmergency ? 'Emergency Token' : 'Walk-in Booking'}
          </h2>
        </div>
        {isEmergency && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
            Emergency tokens are placed at the top of the queue.
          </div>
        )}
        <form onSubmit={submit} className="card space-y-4">
          {/* Doctor picker */}
          {showDoctorPicker ? (
            <div>
              <label className="label">Doctor *</label>
              {doctorsLoading ? (
                <div className="input animate-pulse" />
              ) : (
                <select className="input" value={doctorId} onChange={e => setDoctorId(e.target.value)} required>
                  <option value="">Select doctor…</option>
                  {doctors.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.display_name} — {d.specialization}</option>
                  ))}
                </select>
              )}
            </div>
          ) : userRole === 'doctor' ? null : doctors.length === 1 ? (
            <div className="text-sm text-muted">Doctor: <strong>{doctors[0]?.display_name}</strong></div>
          ) : null}

          {/* Session picker */}
          <div>
            <label className="label">Session *</label>
            {queueLoading ? (
              <div className="input animate-pulse" />
            ) : availableSessions.length === 0 ? (
              <p className="text-sm text-red-600">No open sessions today.</p>
            ) : (
              <select
                className="input"
                value={form.sessionIndex}
                onChange={e => setForm(f => ({ ...f, sessionIndex: parseInt(e.target.value) }))}
                required
              >
                {availableSessions.map((s: any) => (
                  <option key={s.index} value={s.index}>
                    {s.label} ({s.fromLabel}–{s.toLabel})
                    {s.isFull ? ' — Full' : ''}
                    {!s.isOpen && !s.isFull ? ' — Ended' : ''}
                    {` · ${s.tokenCount} tokens`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Patient Name *</label>
            <input className="input" value={form.patientName} onChange={set('patientName')} placeholder="Full name" required />
          </div>
          <div>
            <label className="label">Mobile Number *</label>
            <input className="input" value={form.patientPhone} onChange={set('patientPhone')} placeholder="+919876543210" required />
            {duplicate && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                ⚠️ Patient already has an active appointment today (Token #{duplicate.token_number}, Status: {duplicate.status}
                {duplicate.doctor_name ? ` with ${duplicate.doctor_name}` : ''}). You can still proceed.
              </div>
            )}
          </div>
          <div>
            <label className="label">Gender *</label>
            <div className="flex gap-4 mt-1">
              {(['male', 'female', 'other'] as const).map(g => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="patientGender" value={g} checked={form.patientGender === g}
                    onChange={() => setForm(f => ({ ...f, patientGender: g }))} className="accent-teal w-4 h-4" />
                  <span className="text-sm capitalize">{g}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date of Birth</label>
              <input className="input" type="date" value={form.patientDob} onChange={set('patientDob')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Height (cm)</label>
              <input className="input" type="number" value={form.patientHeightCm} onChange={set('patientHeightCm')} placeholder="e.g. 165" min={50} max={250} />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input className="input" type="number" value={form.patientWeightKg} onChange={set('patientWeightKg')} placeholder="e.g. 65" min={1} max={300} step="0.1" />
            </div>
          </div>
          <div>
            <label className="label">Reason for Visit</label>
            <textarea className="input resize-none h-16" value={form.reasonForVisit} onChange={set('reasonForVisit')} placeholder="Optional" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !doctorId || !form.patientGender || (availableSessions.length === 0 && !isEmergency)}
            className={`w-full ${isEmergency ? 'bg-red-500 text-white font-medium py-3 rounded-xl hover:bg-red-600 transition-colors' : 'btn-primary'}`}
          >
            {loading ? 'Booking…' : isEmergency ? '⚡ Add Emergency Token' : '🚶 Confirm Walk-in'}
          </button>
        </form>
      </div>
    </StaffShell>
  );
}
