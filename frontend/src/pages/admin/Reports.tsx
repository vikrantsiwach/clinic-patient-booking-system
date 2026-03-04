import { useEffect, useState } from 'react';
import { getReports, getDoctors } from '../../services/api';

function Stat({ label, value, sub }: { label: string; value: string | number | null | undefined; sub?: string | number | null }) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-bold text-ink">{value ?? '—'}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
      {sub && <p className="text-xs text-teal mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Reports() {
  const userRole = localStorage.getItem('userRole') || 'receptionist';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-30);
    return d.toISOString().slice(0,10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0,10));
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');

  useEffect(() => {
    if (userRole !== 'doctor') {
      getDoctors().then(r => setDoctors(r.data.doctors || [])).catch(() => {});
    }
  }, [userRole]);

  const load = () => {
    setLoading(true);
    getReports(from, to, selectedDoctor || undefined)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const s = data?.summary;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl">Reports</h2>
        <div className="flex gap-3 items-center flex-wrap">
          {userRole !== 'doctor' && doctors.length > 1 && (
            <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="input text-sm py-2 w-auto">
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
            </select>
          )}
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-2 w-auto" />
          <span className="text-muted text-sm">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-2 w-auto" />
          <button onClick={load} className="btn-primary text-sm py-2 px-4">Apply</button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Total Booked" value={s.total} />
            <Stat label="Completed" value={s.completed} />
            <Stat label="Cancellation Rate" value={`${s.cancellation_rate ?? 0}%`} />
            <Stat label="No-Show Rate" value={`${s.no_show_rate ?? 0}%`} />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Online Bookings" value={s.online} sub="📅" />
            <Stat label="Missed Call" value={s.missed_call} sub="📞" />
            <Stat label="Walk-ins" value={s.walkin} sub="🚶" />
          </div>

          {data.daily?.length > 0 && (
            <div className="card">
              <h3 className="font-medium text-sm mb-4">Daily Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted border-b border-border">
                      <th className="pb-2 text-left">Date</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Completed</th>
                      <th className="pb-2 text-right">Cancelled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.daily.map((d: any) => (
                      <tr key={d.date} className="hover:bg-surface">
                        <td className="py-2 text-label">{d.date}</td>
                        <td className="py-2 text-right">{d.total}</td>
                        <td className="py-2 text-right text-green-700">{d.completed}</td>
                        <td className="py-2 text-right text-red-500">{d.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
