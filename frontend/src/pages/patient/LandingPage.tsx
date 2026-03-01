import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useBookingStore from '../../store/bookingStore';
import { DoctorInfo } from '../../store/bookingStore';
import { getClinicInfo } from '../../services/api';

const CHANNELS = [
  { id: 'online' as const,      label: 'Book Online',  icon: '📅' },
  { id: 'missed_call' as const, label: 'Missed Call',  icon: '📞' },
  { id: 'returning' as const,   label: 'Returning',    icon: '👤' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { channel, setChannel, clinicInfo, setClinicInfo, setSelectedDoctor } = useBookingStore();
  const [loading, setLoading] = useState(!clinicInfo);

  useEffect(() => {
    getClinicInfo()
      .then((r) => { setClinicInfo(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const doctors = (clinicInfo?.doctors as DoctorInfo[] | undefined) || [];
  const clinicName = clinicInfo?.clinicName as string | undefined;

  const handleBookDoctor = (doctor: DoctorInfo) => {
    setSelectedDoctor(doctor);
    navigate('/book');
  };

  const handleCTA = () => {
    if (channel === 'missed_call') navigate('/missed-call');
    else navigate('/my-appointments');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF2EF] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF2EF]">
      {/* Header */}
      <header className="bg-ink text-white px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center text-sm">🏥</div>
          <span className="font-serif text-sm leading-tight">{clinicName || 'Clinic'}</span>
        </Link>
        <Link to="/login" className="text-xs bg-teal hover:bg-teal/90 text-white font-medium px-4 py-1.5 rounded-lg transition-colors">
          Login
        </Link>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Clinic name heading */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl text-ink">{clinicName || 'Welcome'}</h1>
          <p className="text-sm text-muted mt-1">Book your appointment with our doctors</p>
        </div>

        {/* Channel switcher */}
        <div className="card mb-6">
          <p className="text-xs text-muted uppercase tracking-wide mb-3">How would you like to book?</p>
          <div className="flex gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all
                  ${channel === c.id
                    ? 'border-teal bg-teal-light text-teal'
                    : 'border-border bg-surface text-muted hover:border-teal-mid'}`}
              >
                <span className="text-xl">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Online: doctor selection */}
        {channel === 'online' && (
          <div className="space-y-3">
            {doctors.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-4xl mb-3">🏥</p>
                <p className="text-muted text-sm">No doctors available at this time.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted uppercase tracking-wide px-1">Select a doctor to book with</p>
                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleBookDoctor(doc)}
                    className="w-full card text-left hover:shadow-card-lg border-2 border-transparent hover:border-teal transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-teal-light flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                        {doc.photoUrl
                          ? <img src={doc.photoUrl} alt={doc.displayName} className="w-full h-full object-cover" />
                          : '👨‍⚕️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-teal uppercase tracking-wide mb-0.5">{doc.specialization}</p>
                        <p className="font-serif text-lg text-ink leading-tight">{doc.displayName}</p>
                        {doc.qualifications && (
                          <p className="text-xs text-muted mt-0.5">{doc.qualifications}</p>
                        )}
                        {doc.bio && (
                          <p className="text-xs text-label mt-1.5 leading-relaxed line-clamp-2">{doc.bio}</p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-teal bg-teal-light px-3 py-1.5 rounded-lg shrink-0 self-center">
                        Book →
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Missed call */}
        {channel === 'missed_call' && (
          <div className="card mb-6 border-l-4 border-orange">
            <h3 className="font-serif text-lg mb-2">Book via Missed Call</h3>
            <p className="text-sm text-muted mb-3">Call our number and hang up — we'll SMS you slot options. Reply to confirm.</p>
            {!!(clinicInfo?.missedCallNumber) && (
              <div className="bg-orange-light rounded-xl px-4 py-3 mb-4 text-center">
                <p className="text-xs text-muted mb-1">Give a missed call to</p>
                <p className="text-2xl font-bold text-orange tracking-wider">{clinicInfo!.missedCallNumber as string}</p>
              </div>
            )}
            <button onClick={handleCTA} className="w-full bg-orange text-white font-medium px-6 py-3 rounded-xl hover:bg-orange/90 active:scale-95 transition-all">
              How It Works →
            </button>
          </div>
        )}

        {/* Returning patient */}
        {channel === 'returning' && (
          <div className="card mb-6">
            <h3 className="font-serif text-lg mb-2">Returning Patient?</h3>
            <p className="text-sm text-muted mb-4">Enter your registered mobile number to view or manage your appointments.</p>
            <button onClick={handleCTA} className="btn-primary w-full">View My Appointments →</button>
          </div>
        )}
      </div>
    </div>
  );
}
