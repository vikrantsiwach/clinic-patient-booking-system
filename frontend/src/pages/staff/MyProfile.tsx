import { useEffect, useState } from 'react';
import { getMyProfile, updateMyProfile, changePassword } from '../../services/api';

export default function MyProfile() {
  const userRole = localStorage.getItem('userRole') || 'receptionist';

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [form, setForm] = useState({
    fullName: '', email: '', photoUrl: '',
    displayName: '', specialization: '', qualifications: '', bio: '', registrationNo: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  // Password form state
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  useEffect(() => {
    getMyProfile()
      .then(r => {
        const d = r.data;
        setProfile(d);
        setForm({
          fullName: d.full_name || '',
          email: d.email || '',
          photoUrl: d.photo_url || '',
          displayName: d.doctorProfile?.display_name || '',
          specialization: d.doctorProfile?.specialization || '',
          qualifications: d.doctorProfile?.qualifications || '',
          bio: d.doctorProfile?.bio || '',
          registrationNo: d.doctorProfile?.registration_no || '',
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const saveProfile = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setSaveMsg(''); setSaveErr('');
    try {
      const payload: Record<string, string | undefined> = {
        fullName: form.fullName,
        email: form.email,
        photoUrl: form.photoUrl || undefined,
      };
      if (userRole === 'doctor') {
        payload.displayName    = form.displayName;
        payload.specialization = form.specialization;
        payload.qualifications = form.qualifications || undefined;
        payload.bio            = form.bio || undefined;
        payload.registrationNo = form.registrationNo || undefined;
      }
      await updateMyProfile(payload);
      // Update localStorage if name/photo changed
      if (form.fullName) localStorage.setItem('userName', form.fullName);
      if (form.photoUrl) localStorage.setItem('userPhoto', form.photoUrl);
      setSaveMsg('Profile saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveErr((err as any).response?.data?.message || 'Save failed');
    }
    setSaving(false);
  };

  const savePassword = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwd.newPassword !== pwd.confirmPassword) {
      setPwdErr('New passwords do not match'); return;
    }
    setPwdSaving(true); setPwdMsg(''); setPwdErr('');
    try {
      await changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setPwdMsg('Password changed!');
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwdMsg(''), 3000);
    } catch (err) {
      setPwdErr((err as any).response?.data?.message || 'Failed to change password');
    }
    setPwdSaving(false);
  };

  if (loading) return (
      <div className="max-w-xl mx-auto space-y-3">
        <div className="card h-40 animate-pulse" />
        <div className="card h-40 animate-pulse" />
      </div>
  );

  return (
      <div className="max-w-xl mx-auto space-y-6">
        <h2 className="font-serif text-2xl">My Profile</h2>

        {/* Profile form */}
        <form onSubmit={saveProfile} className="card space-y-4">
          <h3 className="font-medium text-sm text-muted uppercase tracking-wide">Profile Information</h3>

          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.fullName} onChange={set('fullName')} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label">Photo URL</label>
            <input className="input" value={form.photoUrl} onChange={set('photoUrl')} placeholder="https://…" />
            {form.photoUrl && (
              <img src={form.photoUrl} alt="Preview" className="mt-2 w-14 h-14 rounded-full object-cover border border-border" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
          </div>

          {userRole === 'doctor' && (
            <>
              <hr className="border-border" />
              <h3 className="font-medium text-sm text-muted uppercase tracking-wide">Doctor Profile</h3>
              <div>
                <label className="label">Display Name</label>
                <input className="input" value={form.displayName} onChange={set('displayName')} placeholder="Dr. Name shown publicly" />
              </div>
              <div>
                <label className="label">Specialization</label>
                <input className="input" value={form.specialization} onChange={set('specialization')} placeholder="e.g. General Physician" />
              </div>
              <div>
                <label className="label">Qualifications</label>
                <input className="input" value={form.qualifications} onChange={set('qualifications')} placeholder="e.g. MBBS, MD" />
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea className="input resize-none h-20" value={form.bio} onChange={set('bio')} placeholder="Short bio shown on landing page" />
              </div>
              <div>
                <label className="label">Registration No.</label>
                <input className="input" value={form.registrationNo} onChange={set('registrationNo')} placeholder="Medical council registration number" />
              </div>
            </>
          )}

          {saveErr && <p className="text-red-600 text-sm">{saveErr}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : saveMsg ? `✓ ${saveMsg}` : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Password form */}
        <form onSubmit={savePassword} className="card space-y-4">
          <h3 className="font-medium text-sm text-muted uppercase tracking-wide">Change Password</h3>
          <div>
            <label className="label">Current Password *</label>
            <input className="input" type="password" value={pwd.currentPassword}
              onChange={e => setPwd(p => ({ ...p, currentPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="label">New Password *</label>
            <input className="input" type="password" value={pwd.newPassword} minLength={8}
              onChange={e => setPwd(p => ({ ...p, newPassword: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Confirm New Password *</label>
            <input className="input" type="password" value={pwd.confirmPassword}
              onChange={e => setPwd(p => ({ ...p, confirmPassword: e.target.value }))} required />
          </div>
          {pwdErr && <p className="text-red-600 text-sm">{pwdErr}</p>}
          <button type="submit" disabled={pwdSaving} className="btn-primary">
            {pwdSaving ? 'Changing…' : pwdMsg ? `✓ ${pwdMsg}` : 'Change Password'}
          </button>
        </form>
      </div>
  );
}
