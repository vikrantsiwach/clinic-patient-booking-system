import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMCAnalytics, updateMCConfig } from '../../../services/api';

function Stat({ label, value, color }: { label: string; value: string | number | null | undefined; color: string }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-bold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

export default function MCAdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [config, setConfig] = useState({ maxCallsPer24h: 2, maxCallsPer7d: 5, sessionExpiryMins: 15, burstThreshold: 15, systemEnabled: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMCAnalytics().then(r => setData(r.data)).catch(() => {});
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await updateMCConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const s = data?.summary;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl">Missed Call Analytics</h2>
        <button onClick={() => navigate('/admin/missed-call/blacklist')} className="btn-secondary text-sm py-2 px-4">
          🚷 Blacklist Manager
        </button>
      </div>

      {/* Stats */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Total Received" value={s.total_received} color="text-ink" />
          <Stat label="Booked" value={s.booked} color="text-teal" />
          <Stat label="Blocked" value={s.blocked} color="text-red-500" />
          <Stat label="Conversion" value={`${s.conversion_rate ?? 0}%`} color="text-orange" />
        </div>
      )}

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Rate Limited" value={s.rate_limited} color="text-amber" />
          <Stat label="Blacklisted" value={s.blacklisted} color="text-red-400" />
          <Stat label="Velocity Blocked" value={s.velocity_blocked} color="text-purple" />
          <Stat label="Duplicate" value={s.duplicate} color="text-muted" />
        </div>
      )}

      {/* Config */}
      <div className="card">
        <h3 className="font-medium text-sm mb-4">System Configuration</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Max calls per 24h</label>
            <input type="number" className="input" value={config.maxCallsPer24h} onChange={e => setConfig(c => ({...c, maxCallsPer24h: parseInt(e.target.value)}))} min={1} max={20} />
          </div>
          <div>
            <label className="label">Max calls per 7d</label>
            <input type="number" className="input" value={config.maxCallsPer7d} onChange={e => setConfig(c => ({...c, maxCallsPer7d: parseInt(e.target.value)}))} min={1} max={50} />
          </div>
          <div>
            <label className="label">Session expiry (mins)</label>
            <input type="number" className="input" value={config.sessionExpiryMins} onChange={e => setConfig(c => ({...c, sessionExpiryMins: parseInt(e.target.value)}))} min={5} max={60} />
          </div>
          <div>
            <label className="label">Burst threshold (calls/10min)</label>
            <input type="number" className="input" value={config.burstThreshold} onChange={e => setConfig(c => ({...c, burstThreshold: parseInt(e.target.value)}))} min={5} max={100} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={config.systemEnabled} onChange={e => setConfig(c => ({...c, systemEnabled: e.target.checked}))} className="accent-teal w-4 h-4" />
            <span className="text-sm font-medium">System Enabled</span>
          </label>
          <button onClick={saveConfig} disabled={saving} className="btn-primary text-sm py-2 px-4">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Config'}
          </button>
        </div>
      </div>

      {/* Daily table */}
      {data?.daily?.length > 0 && (
        <div className="card mt-6">
          <h3 className="font-medium text-sm mb-4">Daily Report</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-border">
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-right">Received</th>
                  <th className="pb-2 text-right">Booked</th>
                  <th className="pb-2 text-right">Blocked</th>
                  <th className="pb-2 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.daily.map((d: any) => (
                  <tr key={d.call_date} className="hover:bg-surface">
                    <td className="py-2">{d.call_date}</td>
                    <td className="py-2 text-right">{d.total_received}</td>
                    <td className="py-2 text-right text-teal">{d.booked}</td>
                    <td className="py-2 text-right text-red-500">{parseInt(d.rate_limited||0)+parseInt(d.blacklisted||0)+parseInt(d.velocity_blocked||0)}</td>
                    <td className="py-2 text-right text-orange">{d.conversion_rate_pct ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
