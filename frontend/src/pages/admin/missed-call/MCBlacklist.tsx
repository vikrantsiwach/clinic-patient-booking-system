import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffShell from '../../../components/layout/StaffShell';
import { addToBlacklist, removeFromBlacklist } from '../../../services/api';

export default function MCBlacklist() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: '', reason: 'manual_staff', notes: '', isPermanent: false, expiresAt: '' });
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: (e.target as HTMLInputElement).type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const add = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await addToBlacklist(form);
      setBlacklist(b => [...b, { ...form, id: Date.now() }]);
      setForm({ phone: '', reason: 'manual_staff', notes: '', isPermanent: false, expiresAt: '' });
    } catch (err) {
      setError((err as any).response?.data?.message || 'Failed');
    }
    setSaving(false);
  };

  const remove = async (phone: string) => {
    await removeFromBlacklist(phone);
    setBlacklist(b => b.filter(x => x.phone !== phone));
  };

  return (
    <StaffShell>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/admin/missed-call')} className="text-muted hover:text-ink">← Back</button>
        <h2 className="font-serif text-2xl">Blacklist Manager</h2>
      </div>

      <div className="card mb-6 max-w-lg">
        <h3 className="font-medium text-sm mb-4">Add Number to Blacklist</h3>
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="label">Phone Number *</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="+919876543210" required />
          </div>
          <div>
            <label className="label">Reason *</label>
            <select className="input" value={form.reason} onChange={set('reason')}>
              <option value="manual_staff">Manual (staff decision)</option>
              <option value="dnd_registry">DND Registry</option>
              <option value="invalid_format">Invalid number format</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={set('notes')} placeholder="Optional note" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isPermanent} onChange={set('isPermanent')} className="accent-teal" />
            <span className="text-sm">Permanent block</span>
          </label>
          {!form.isPermanent && (
            <div>
              <label className="label">Expires At *</label>
              <input type="datetime-local" className="input" value={form.expiresAt} onChange={set('expiresAt')} required={!form.isPermanent} />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Adding…' : '🚷 Add to Blacklist'}
          </button>
        </form>
      </div>

      {blacklist.length > 0 && (
        <div className="card">
          <h3 className="font-medium text-sm mb-3">Blacklisted Numbers</h3>
          <div className="space-y-2">
            {blacklist.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-mono text-sm">{b.phone}</p>
                  <p className="text-xs text-muted">{b.reason}{b.notes ? ` · ${b.notes}` : ''}{b.isPermanent ? ' · Permanent' : ` · Until ${b.expiresAt}`}</p>
                </div>
                <button onClick={() => remove(b.phone)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </StaffShell>
  );
}
