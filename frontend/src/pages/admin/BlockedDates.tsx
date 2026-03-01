import { useEffect, useState } from 'react';
import StaffShell from '../../components/layout/StaffShell';
import { getBlockedDates, addBlockedDate, removeBlockedDate, getDoctors } from '../../services/api';

export default function BlockedDates() {
  const userRole   = localStorage.getItem('userRole') || 'receptionist';
  const myDoctorId = localStorage.getItem('doctorId') || '';

  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState(userRole === 'doctor' ? myDoctorId : '');

  const [form, setForm] = useState({ blockDate: '', startTime: '', endTime: '', reason: '' });
  const [blocks, setBlocks] = useState<{id: unknown; blockDate: string; startTime: string; endTime: string; reason: string}[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userRole !== 'doctor') {
      getDoctors().then(r => {
        const docs = r.data.doctors || [];
        setDoctors(docs);
        if (docs.length === 1) setSelectedDoctor(docs[0].id);
      }).catch(() => {});
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'doctor' && !selectedDoctor) return;
    getBlockedDates(selectedDoctor || undefined).then(r => setBlocks(r.data.blockedDates)).catch(() => {});
  }, [selectedDoctor, userRole]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const add = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await addBlockedDate({ ...form, doctorId: selectedDoctor || undefined });
      setBlocks(b => [...b, { id: res.data.id, ...form }]);
      setForm({ blockDate: '', startTime: '', endTime: '', reason: '' });
    } catch (err) {
      alert((err as any).response?.data?.message || 'Failed to block date');
    }
    setSaving(false);
  };

  const remove = async (id: unknown) => {
    await removeBlockedDate(id as string);
    setBlocks(b => b.filter(x => x.id !== id));
  };

  return (
    <StaffShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-serif text-2xl">Blocked Dates</h2>
        {userRole !== 'doctor' && doctors.length > 1 && (
          <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="input text-sm py-2 w-auto">
            <option value="">Select doctor…</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
          </select>
        )}
      </div>

      <div className="card mb-6">
        <h3 className="font-medium text-sm mb-4">Add New Block</h3>
        <form onSubmit={add} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="label">Date to Block *</label>
            <input type="date" value={form.blockDate} onChange={set('blockDate')} className="input" required />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="label">Reason</label>
            <input value={form.reason} onChange={set('reason')} placeholder="e.g. Holiday, Leave…" className="input" />
          </div>
          <div>
            <label className="label">Start Time (leave blank for full day)</label>
            <input type="time" value={form.startTime} onChange={set('startTime')} className="input" />
          </div>
          <div>
            <label className="label">End Time</label>
            <input type="time" value={form.endTime} onChange={set('endTime')} className="input" />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Blocking…' : '🚫 Block This Date'}
            </button>
          </div>
        </form>
      </div>

      {blocks.length > 0 && (
        <div className="card">
          <h3 className="font-medium text-sm mb-3">Active Blocks</h3>
          <div className="space-y-2">
            {blocks.map(b => (
              <div key={String(b.id)} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{b.blockDate}</p>
                  <p className="text-xs text-muted">
                    {b.startTime ? `${b.startTime}–${b.endTime}` : 'Full day'}
                    {b.reason ? ` · ${b.reason}` : ''}
                  </p>
                </div>
                <button onClick={() => remove(b.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
