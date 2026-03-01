import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientShell from '../../components/layout/PatientShell';
import useBookingStore from '../../store/bookingStore';
import { SessionInfo } from '../../store/bookingStore';
import { getTodayQueue } from '../../services/api';

interface QueueSession extends SessionInfo {
  isOpen: boolean;
  isUpcoming: boolean;
  isEnded: boolean;
  tokenCount: number;
  maxTokens: number | null;
  isFull: boolean;
}

interface QueueData {
  date: string;
  closed: boolean;
  reason?: string;
  sessions: QueueSession[];
}

export default function SessionPickerPage() {
  const navigate = useNavigate();
  const { setSelectedSession, selectedDoctor } = useBookingStore();
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedDoctor) { navigate('/'); return; }
    getTodayQueue(selectedDoctor.id)
      .then(r => { setQueueData(r.data as QueueData); setLoading(false); })
      .catch(() => { setError('Could not load clinic sessions. Please try again.'); setLoading(false); });
  }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const select = (session: QueueSession) => {
    setSelectedSession(session);
    navigate('/book/details');
  };

  return (
    <PatientShell step={0} title="Book a Token" subtitle={selectedDoctor ? `${selectedDoctor.displayName} · Today — ${today}` : `Today — ${today}`}>
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-ghost mt-4">Try Again</button>
        </div>
      ) : queueData?.closed ? (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🏥</p>
          <h3 className="font-serif text-xl mb-2">Clinic Closed Today</h3>
          <p className="text-sm text-muted">No sessions are available for today. Please try again tomorrow.</p>
          <button onClick={() => navigate('/')} className="btn-ghost mt-4">← Back to Home</button>
        </div>
      ) : queueData ? (
        <div className="space-y-3">
          {queueData.sessions.map((session) => {
            const remaining = session.maxTokens !== null
              ? session.maxTokens - session.tokenCount
              : null;

            return (
              <button
                key={session.index}
                onClick={() => select(session)}
                disabled={!session.isOpen}
                className={`w-full card text-left transition-all active:scale-[0.98]
                  ${session.isOpen
                    ? 'hover:shadow-card-lg border-2 border-transparent hover:border-teal cursor-pointer'
                    : 'opacity-60 cursor-not-allowed'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-serif text-lg text-ink">{session.label}</p>
                    <p className="text-sm text-muted mt-0.5">
                      {session.fromLabel} – {session.toLabel}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {session.isEnded
                        ? `${session.tokenCount} tokens were taken`
                        : session.isUpcoming
                          ? `Opens at ${session.fromLabel}`
                          : `${session.tokenCount} taken${remaining !== null ? ` · ${remaining} remaining` : ''}`
                      }
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {session.isFull ? (
                      <span className="text-xs font-medium text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">Full</span>
                    ) : session.isUpcoming ? (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">Not Yet Open</span>
                    ) : session.isEnded ? (
                      <span className="text-xs font-medium text-muted bg-border px-3 py-1.5 rounded-lg">Ended</span>
                    ) : (
                      <span className="text-xs font-medium text-teal bg-teal-light px-3 py-1.5 rounded-lg">Book →</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

<button onClick={() => navigate('/')} className="btn-ghost w-full mt-2">← Back to Home</button>
        </div>
      ) : null}
    </PatientShell>
  );
}
