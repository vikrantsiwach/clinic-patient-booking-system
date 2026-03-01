import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientShell from '../../components/layout/PatientShell';
import { StatusPill } from '../../components/ui/StatusPill';
import { getMyAppointments, cancelMyAppointment, sendOtp, verifyOtp } from '../../services/api';

function OtpLogin({ onSuccess }: { onSuccess: () => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtpHandler = async () => {
    setLoading(true); setError('');
    try {
      await sendOtp(phone);
      setStep('otp');
    } catch (e) {
      setError((e as any).response?.data?.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const verifyHandler = async () => {
    setLoading(true); setError('');
    try {
      const res = await verifyOtp(phone, otp);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userRole', 'patient');
      onSuccess();
    } catch (e) {
      setError((e as any).response?.data?.message || 'Invalid OTP');
    }
    setLoading(false);
  };

  return (
    <div className="card max-w-sm mx-auto mt-10">
      <h3 className="font-serif text-lg mb-4">Login to View Appointments</h3>
      {step === 'phone' ? (
        <>
          <label className="label">Registered Mobile Number</label>
          <input className="input mb-4" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+919876543210" />
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <button onClick={sendOtpHandler} disabled={loading || !phone} className="btn-primary w-full">
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">OTP sent to {phone}</p>
          <label className="label">Enter 6-digit OTP</label>
          <input className="input mb-4" value={otp} onChange={e=>setOtp(e.target.value)} placeholder="123456" maxLength={6} />
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <button onClick={verifyHandler} disabled={loading || otp.length < 6} className="btn-primary w-full">
            {loading ? 'Verifying…' : 'Verify & Login'}
          </button>
          <button onClick={() => setStep('phone')} className="btn-ghost w-full mt-2">← Change Number</button>
        </>
      )}
    </div>
  );
}

function currentTimeLabel() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

function statusDisplay(appt: any) {
  if (appt.status === 'no_show') return "Didn't Show Up";
  if (appt.status === 'cancelled' && appt.cancelled_by_role === 'patient') return 'Cancelled by You';
  if (appt.status === 'cancelled') return 'Cancelled';
  return appt.status;
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [appointments, setAppointments] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(false);

  const loadAppointments = () => {
    setLoading(true);
    getMyAppointments()
      .then(r => { setAppointments(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (isLoggedIn) loadAppointments(); }, [isLoggedIn]);

  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this token?')) return;
    try {
      await cancelMyAppointment(id, '');
      loadAppointments();
    } catch (e) {
      alert((e as any).response?.data?.message || 'Cannot cancel');
    }
  };

  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  if (!isLoggedIn) return (
    <PatientShell title="My Appointments">
      <OtpLogin onSuccess={() => setIsLoggedIn(true)} />
    </PatientShell>
  );

  return (
    <PatientShell title="My Appointments">
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : (
        <>
          {appointments.upcoming.length === 0 && appointments.past.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎫</p>
              <p className="font-medium">No appointments yet.</p>
              <button onClick={() => navigate('/book')} className="btn-primary mt-4">Book Token</button>
            </div>
          ) : null}

          {appointments.upcoming.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-sm text-muted uppercase tracking-wide mb-3">Today's Tokens</h3>
              <div className="space-y-3">
                {appointments.upcoming.map((a: any) => (
                  <div key={a.id} className="card">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-3xl text-teal">#{a.token_number}</span>
                          {a.is_emergency && (
                            <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded">Emergency</span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {currentTimeLabel()} Session · {fmtDate(a.appointment_date)}
                        </p>
                        <p className="text-xs text-muted">{a.doctor_name} · {a.specialization}</p>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono text-xs text-muted">{a.reference_code}</span>
                      {['booked','confirmed'].includes(a.status) && (
                        <button onClick={() => cancel(a.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {appointments.past.length > 0 && (
            <div>
              <h3 className="font-medium text-sm text-muted uppercase tracking-wide mb-3">Past</h3>
              <div className="space-y-3">
                {appointments.past.map((a: any) => (
                  <div key={a.id} className="card opacity-70">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xl text-muted">#{a.token_number}</span>
                        </div>
                        <p className="text-xs text-muted">
                          {currentTimeLabel()} Session · {fmtDate(a.appointment_date)}
                        </p>
                        <p className="text-xs text-muted">{a.doctor_name}</p>
                      </div>
                      <span className="text-xs text-muted font-medium capitalize">
                        {statusDisplay(a)}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-muted">{a.reference_code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/book')} className="btn-primary w-full mt-6">Book New Token</button>
        </>
      )}
    </PatientShell>
  );
}
