import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientShell from '../../components/layout/PatientShell';
import useBookingStore from '../../store/bookingStore';
import { createAppointment, getTodayQueue } from '../../services/api';

function Row({ label, value }: { label: string; value?: string | null }) {
  return value ? (
    <div className="flex justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-ink text-right">{value}</span>
    </div>
  ) : null;
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { selectedSession, selectedDoctor, patientDetails, setConfirmedAppointment } = useBookingStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selectedSession || !selectedDoctor) { navigate('/book'); return null; }

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      // Re-check session status before submitting — catches cases where the
      // user navigated here while session was open but it has since closed.
      const queueRes = await getTodayQueue(selectedDoctor.id);
      const freshSession = queueRes.data?.sessions?.find(
        (s: any) => s.index === selectedSession.index
      );
      if (!freshSession?.isOpen) {
        setError(
          freshSession?.isEnded
            ? 'This session has ended. Please go back and select an open session.'
            : 'This session is not yet open. Please go back and wait until the session starts.'
        );
        setLoading(false);
        return;
      }

      const res = await createAppointment({
        doctorId: selectedDoctor.id,
        sessionIndex: selectedSession.index,
        patientName: patientDetails.name,
        patientPhone: patientDetails.phone,
        patientGender: patientDetails.gender,
        patientDob: patientDetails.dob || undefined,
        patientEmail: patientDetails.email || undefined,
        patientHeightCm: patientDetails.heightCm ? Number(patientDetails.heightCm) : undefined,
        patientWeightKg: patientDetails.weightKg ? Number(patientDetails.weightKg) : undefined,
        reasonForVisit: patientDetails.reason || undefined,
        consent: true,
      });
      setConfirmedAppointment(res.data.appointment);
      navigate('/book/confirmed');
    } catch (err) {
      const e = (err as any).response?.data;
      if (e?.error === 'SESSION_FULL') {
        setError('This session is now full. Please go back and select another session.');
      } else if (e?.error === 'SESSION_NOT_OPEN') {
        setError('This session has not started yet. Please go back and select an open session.');
      } else if (e?.error === 'SESSION_CLOSED') {
        setError('This session has ended. Please go back and select an open session.');
      } else if (e?.error === 'CLINIC_CLOSED') {
        setError('The clinic is closed today.');
      } else {
        setError(e?.message || 'Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <PatientShell step={2} title="Review Booking" subtitle="Please confirm your details">
      <div className="card mb-4">
        <Row label="Doctor" value={selectedDoctor.displayName} />
        <Row label="Session" value={`${selectedSession.label} · ${selectedSession.fromLabel}–${selectedSession.toLabel} · Today`} />
        <Row label="Patient" value={patientDetails.name} />
        <Row label="Gender" value={patientDetails.gender ? patientDetails.gender.charAt(0).toUpperCase() + patientDetails.gender.slice(1) : undefined} />
        <Row label="Mobile" value={patientDetails.phone} />
        <Row label="Date of Birth" value={patientDetails.dob} />
        <Row label="Height" value={patientDetails.heightCm ? `${patientDetails.heightCm} cm` : undefined} />
        <Row label="Weight" value={patientDetails.weightKg ? `${patientDetails.weightKg} kg` : undefined} />
        <Row label="Email" value={patientDetails.email} />
        <Row label="Reason" value={patientDetails.reason} />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 border border-red-200">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => navigate('/book/details')} disabled={loading} className="btn-ghost flex-1">← Edit</button>
        <button onClick={confirm} disabled={loading} className="btn-primary flex-1">
          {loading ? 'Confirming…' : 'Confirm Booking ✓'}
        </button>
      </div>
    </PatientShell>
  );
}
