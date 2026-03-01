import { useNavigate } from 'react-router-dom';
import PatientShell from '../../components/layout/PatientShell';
import useBookingStore from '../../store/bookingStore';

const STEPS = [
  { icon: '📞', title: 'Give a Missed Call', desc: 'Call our clinic number and hang up within 3 seconds. It\'s completely free.' },
  { icon: '💬', title: 'Receive SMS Options', desc: 'Within 30 seconds you\'ll get 3 slot options via SMS. Reply with your choice.' },
  { icon: '✅', title: 'Appointment Confirmed', desc: 'Reply with the option number. Get a confirmation SMS with your reference code.' },
];

const SCENARIOS = [
  { title: '✅ Successful Booking', bg: 'bg-teal-light', border: 'border-teal-mid',
    messages: ['→ Missed call received', '← Reply 1A3B for 3 Mar 10:00, 2A3B for 4 Mar 11:00, 3A3B for 5 Mar 9:00', '→ 1A3B', '← Confirmed! Ref: APT-2026-01234'] },
  { title: '⏰ Session Expired', bg: 'bg-amber/5', border: 'border-amber/30',
    messages: ['← Options sent (15 min ago)', '→ 1A3B (too late)', '← Session expired. Give another missed call to rebook.'] },
  { title: '🔄 Duplicate Guard', bg: 'bg-purple-light', border: 'border-purple/20',
    messages: ['→ Missed call received', '← You already have an appointment on 5 Mar at 10:00. Ref: APT-2026-01100'] },
  { title: '❌ Cancel via SMS', bg: 'bg-red-50', border: 'border-red-200',
    messages: ['→ CANCEL', '← Your appointment on 3 Mar at 10:00 has been cancelled.'] },
];

const SPAM_LAYERS = [
  { icon: '📡', title: 'HMAC Verification', desc: 'Every webhook verified against MSG91 secret' },
  { icon: '🚫', title: 'Blacklist Check', desc: 'Permanent or temporary blocks applied first' },
  { icon: '⏱️', title: 'Rate Limiting', desc: 'Max 2 calls per number per 24 hours' },
  { icon: '📋', title: 'Number Validation', desc: 'E.164 format + TRAI DND registry check' },
  { icon: '🌊', title: 'Velocity Detection', desc: '>15 calls/10 min triggers system pause' },
  { icon: '📅', title: 'Duplicate Guard', desc: 'Blocks if patient already has upcoming appointment' },
];

export default function MissedCallHowItWorks() {
  const navigate = useNavigate();
  const { clinicInfo } = useBookingStore();

  return (
    <PatientShell>
      <div className="pb-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-light rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📞</div>
          <h2 className="font-serif text-2xl text-ink mb-2">Book via Missed Call</h2>
          <p className="text-sm text-muted">Zero cost, zero internet needed. Just call & hang up.</p>
        </div>

        {/* VMN number */}
        {!!(clinicInfo?.missedCallNumber) && (
          <div className="bg-orange-light border-2 border-orange-mid rounded-2xl p-5 mb-6 text-center">
            <p className="text-xs text-muted mb-1">Give a missed call to</p>
            <p className="text-3xl font-bold text-orange tracking-wider">{clinicInfo!.missedCallNumber as string}</p>
            <p className="text-xs text-muted mt-1">Call and hang up within 3 seconds</p>
          </div>
        )}

        {/* 3 Steps */}
        <div className="card mb-6">
          <h3 className="font-medium text-sm mb-4">How It Works</h3>
          <div className="space-y-4">
            {STEPS.map((s, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center text-xl shrink-0">{s.icon}</div>
                <div>
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="text-xs text-muted mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SMS Scenarios */}
        <div className="card mb-6">
          <h3 className="font-medium text-sm mb-4">SMS Scenarios</h3>
          <div className="grid grid-cols-1 gap-3">
            {SCENARIOS.map((sc, i) => (
              <div key={i} className={`rounded-xl border p-3 ${sc.bg} ${sc.border}`}>
                <p className="font-medium text-xs mb-2">{sc.title}</p>
                <div className="space-y-1">
                  {sc.messages.map((msg, j) => (
                    <p key={j} className={`text-xs font-mono ${msg.startsWith('→') ? 'text-ink' : 'text-teal'}`}>{msg}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spam Protection */}
        <div className="card mb-6">
          <h3 className="font-medium text-sm mb-4">Spam Protection (6 Layers)</h3>
          <div className="grid grid-cols-2 gap-3">
            {SPAM_LAYERS.map((l, i) => (
              <div key={i} className="bg-surface rounded-xl p-3">
                <span className="text-xl block mb-1">{l.icon}</span>
                <p className="text-xs font-medium">{l.title}</p>
                <p className="text-xs text-muted mt-0.5">{l.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate('/')} className="btn-ghost flex-1">← Back</button>
          <button onClick={() => navigate('/book')} className="btn-secondary flex-1">Book Online Instead</button>
        </div>
      </div>
    </PatientShell>
  );
}
