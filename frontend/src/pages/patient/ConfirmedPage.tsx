import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientShell from '../../components/layout/PatientShell';
import useBookingStore from '../../store/bookingStore';
import { getQueuePosition } from '../../services/api';

const DONE_STATUSES = ['completed', 'no_show', 'cancelled'];

export default function ConfirmedPage() {
  const navigate = useNavigate();
  const { confirmedAppointment, reset } = useBookingStore();
  const [queuePos, setQueuePos] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!confirmedAppointment?.referenceCode) return;

    const poll = () => {
      getQueuePosition(confirmedAppointment.referenceCode)
        .then(r => {
          setQueuePos(r.data);
          if (DONE_STATUSES.includes(r.data.status)) {
            clearInterval(intervalRef.current!);
          }
        })
        .catch(() => {});
    };

    poll();
    intervalRef.current = setInterval(poll, 20000);
    return () => clearInterval(intervalRef.current!);
  }, [confirmedAppointment?.referenceCode]);

  if (!confirmedAppointment) { navigate('/'); return null; }

  const { referenceCode, token } = confirmedAppointment;

  const bookAnother = () => { reset(); navigate('/book'); };

  const statusLabel = (status: string) => {
    if (status === 'no_show') return "Didn't Show Up";
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'completed') return 'Completed';
    if (status === 'arrived') return 'With Doctor';
    if (status === 'confirmed') return 'Called';
    return 'Waiting';
  };

  return (
    <PatientShell step={3}>
      <div className="text-center py-6">
        <div className="w-20 h-20 rounded-full bg-teal-light flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
        <h2 className="font-serif text-2xl text-ink mb-1">Token Booked!</h2>
        <p className="text-sm text-muted">A confirmation SMS has been sent to your number.</p>
      </div>

      {/* Token number */}
      <div className="card mb-4 text-center">
        <p className="text-xs text-muted uppercase tracking-widest mb-1">Your Token Number</p>
        <p className="font-bold text-6xl text-teal mb-2">#{token}</p>
        <p className="font-mono text-xs text-muted">{referenceCode}</p>
      </div>

      {/* Live queue position */}
      {queuePos && !DONE_STATUSES.includes(queuePos.status) && (
        <div className="card mb-4 bg-teal-light border border-teal/20">
          <p className="text-xs text-muted uppercase tracking-wide mb-2">Live Queue Status</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">
                {queuePos.tokensAhead === 0
                  ? "You're next!"
                  : `${queuePos.tokensAhead} ${queuePos.tokensAhead === 1 ? 'person' : 'people'} ahead`}
              </p>
              {queuePos.currentlyServing && (
                <p className="text-xs text-muted mt-0.5">Currently serving Token #{queuePos.currentlyServing}</p>
              )}
            </div>
            <span className="text-xs font-medium text-teal bg-white px-3 py-1.5 rounded-lg shadow-sm">
              {statusLabel(queuePos.status)}
            </span>
          </div>
          <p className="text-xs text-muted mt-3">Updates every 20 seconds</p>
        </div>
      )}

      {/* Completed/no_show banner */}
      {queuePos?.status === 'completed' && (
        <div className="card mb-4 bg-green-50 border border-green-200 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="font-medium text-green-700">Visit Completed</p>
          <p className="text-xs text-muted mt-1">Thank you for visiting the clinic.</p>
        </div>
      )}
      {queuePos?.status === 'no_show' && (
        <div className="card mb-4 bg-amber-50 border border-amber-200 text-center">
          <p className="font-medium text-amber-700">Marked as Didn't Show Up</p>
        </div>
      )}
      {queuePos?.status === 'cancelled' && (
        <div className="card mb-4 bg-red-50 border border-red-200 text-center">
          <p className="font-medium text-red-600">Token Cancelled</p>
        </div>
      )}

      <div className="space-y-3">
        <button onClick={bookAnother} className="btn-primary w-full">Book Another Token</button>
        <button onClick={() => navigate('/')} className="btn-ghost w-full">Back to Home</button>
      </div>
    </PatientShell>
  );
}
