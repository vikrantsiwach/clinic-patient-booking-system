import { useEffect, useState } from 'react';
import StaffShell from '../../components/layout/StaffShell';
import { getClinicSettings, updateClinicSettings } from '../../services/api';

export default function ClinicSettings() {
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getClinicSettings()
      .then(r => { setClinicName(r.data.clinicName || ''); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const save = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setError('');
    try {
      await updateClinicSettings({ clinicName });
      setMsg('Clinic name updated successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setError((err as any).response?.data?.message || 'Failed to update');
    }
    setSaving(false);
  };

  return (
    <StaffShell>
      <h2 className="font-serif text-2xl mb-6">Clinic Settings</h2>

      <div className="max-w-md card">
        <h3 className="font-medium text-sm mb-4">General</h3>
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-border rounded animate-pulse w-1/3" />
            <div className="h-10 bg-border rounded animate-pulse" />
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Clinic Name *</label>
              <input
                className="input"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                placeholder="e.g. City Health Clinic"
                required
                minLength={2}
                maxLength={255}
              />
              <p className="text-xs text-muted mt-1">Displayed on the patient-facing landing page and header.</p>
            </div>
            {msg && <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">{msg}</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>
    </StaffShell>
  );
}
