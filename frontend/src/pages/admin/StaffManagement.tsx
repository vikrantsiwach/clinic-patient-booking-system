import { useState, useEffect } from 'react';
import { createStaff, listStaff, updateStaffStatus, updateStaffDetails } from '../../services/api';

type StaffMember = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at?: string;
  // doctor fields (present when role='doctor')
  display_name?: string;
  specialization?: string;
  qualifications?: string;
  bio?: string;
  photo_url?: string;
  doctor_phone?: string;
  registration_no?: string;
};

type EditForm = {
  fullName: string; email: string; role: string; password: string;
  displayName: string; specialization: string; qualifications: string;
  bio: string; photoUrl: string; phone: string; registrationNo: string;
};

export default function StaffManagement() {
  const [tab, setTab] = useState('pending');

  // Create form
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'receptionist' });
  const [saving, setSaving] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');
  const [createError, setCreateError] = useState('');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Staff list
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    fullName: '', email: '', role: '', password: '',
    displayName: '', specialization: '', qualifications: '',
    bio: '', photoUrl: '', phone: '', registrationNo: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const setEdit = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (tab === 'pending' || tab === 'all') loadStaff(tab === 'pending' ? 'pending' : undefined);
  }, [tab]);

  async function loadStaff(status?: string) {
    setListLoading(true);
    try {
      const res = await listStaff(status);
      setStaffList(res.data.staff);
    } catch {}
    setListLoading(false);
  }

  function startEdit(s: StaffMember) {
    setEditingId(s.id);
    setEditForm({
      fullName: s.full_name, email: s.email, role: s.role, password: '',
      displayName: s.display_name || '', specialization: s.specialization || '',
      qualifications: s.qualifications || '', bio: s.bio || '',
      photoUrl: s.photo_url || '', phone: s.doctor_phone || '',
      registrationNo: s.registration_no || '',
    });
    setEditError('');
  }

  function cancelEdit() { setEditingId(null); setEditError(''); }

  async function saveEdit(id: string) {
    setEditSaving(true); setEditError('');
    try {
      const payload: Record<string, unknown> = {
        fullName: editForm.fullName, email: editForm.email, role: editForm.role,
      };
      if (editForm.password) payload.password = editForm.password;
      if (editForm.role === 'doctor') {
        payload.displayName = editForm.displayName;
        payload.specialization = editForm.specialization;
        payload.qualifications = editForm.qualifications || null;
        payload.bio = editForm.bio || null;
        payload.photoUrl = editForm.photoUrl || null;
        payload.phone = editForm.phone || null;
        payload.registrationNo = editForm.registrationNo || null;
      }
      await updateStaffDetails(id, payload);
      setEditingId(null);
      setActionMsg('Details updated');
      setTimeout(() => setActionMsg(''), 3000);
      loadStaff(tab === 'pending' ? 'pending' : undefined);
    } catch (err) {
      setEditError((err as any).response?.data?.message || 'Failed to update');
    }
    setEditSaving(false);
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateStaffStatus(id, status);
      setActionMsg(`Account ${status}`);
      setTimeout(() => setActionMsg(''), 3000);
      loadStaff(tab === 'pending' ? 'pending' : undefined);
    } catch (err) {
      setActionMsg((err as any).response?.data?.message || 'Failed');
    }
  }

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setCreateError(''); setCreateSuccess('');
    try {
      await createStaff(form);
      setCreateSuccess(`Account created for ${form.fullName} (${form.role})`);
      setForm({ email: '', password: '', fullName: '', role: 'receptionist' });
    } catch (err) {
      setCreateError((err as any).response?.data?.message || 'Failed to create account');
    }
    setSaving(false);
  };

  const statusPill = (s: string) => {
    const map: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', active: 'bg-green-100 text-green-700', suspended: 'bg-red-100 text-red-700' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[s] || ''}`}>{s}</span>;
  };

  return (
    <>
      <h2 className="font-serif text-2xl mb-6">Staff Management</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {[
          { id: 'pending', label: 'Pending Requests' },
          { id: 'all', label: 'All Staff' },
          { id: 'create', label: 'Create Account' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-teal text-white' : 'text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending Requests / All Staff */}
      {(tab === 'pending' || tab === 'all') && (
        <div className="max-w-2xl">
          {actionMsg && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">{actionMsg}</p>}
          {listLoading ? (
            <div className="card animate-pulse h-20" />
          ) : staffList.length === 0 ? (
            <div className="card text-center text-muted py-10">
              {tab === 'pending' ? 'No pending requests' : 'No staff accounts found'}
            </div>
          ) : (
            <div className="space-y-3">
              {staffList.map(s => (
                <div key={s.id} className="card">
                  {editingId === s.id ? (
                    /* ── Inline edit form ── */
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-muted uppercase tracking-wide">Editing: {s.full_name}</p>

                      {/* Account fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Full Name *</label>
                          <input className="input" value={editForm.fullName} onChange={setEdit('fullName')} />
                        </div>
                        <div>
                          <label className="label">Email *</label>
                          <input className="input" type="email" value={editForm.email} onChange={setEdit('email')} />
                        </div>
                        <div>
                          <label className="label">Role *</label>
                          <select className="input" value={editForm.role} onChange={setEdit('role')}>
                            <option value="receptionist">Receptionist</option>
                            <option value="doctor">Doctor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">New Password <span className="text-muted font-normal">(leave blank to keep)</span></label>
                          <input className="input" type="password" value={editForm.password} onChange={setEdit('password')} placeholder="Min 8 characters" />
                        </div>
                      </div>

                      {/* Doctor profile fields */}
                      {editForm.role === 'doctor' && (
                        <>
                          <p className="text-xs font-medium text-muted uppercase tracking-wide border-t border-border pt-3">Doctor Profile</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="label">Display Name * <span className="text-muted font-normal">(shown to patients)</span></label>
                              <input className="input" value={editForm.displayName} onChange={setEdit('displayName')} required />
                            </div>
                            <div>
                              <label className="label">Specialization *</label>
                              <input className="input" value={editForm.specialization} onChange={setEdit('specialization')} placeholder="e.g. General Physician" />
                            </div>
                            <div>
                              <label className="label">Qualifications</label>
                              <input className="input" value={editForm.qualifications} onChange={setEdit('qualifications')} placeholder="e.g. MBBS, MD" />
                            </div>
                            <div>
                              <label className="label">Phone</label>
                              <input className="input" value={editForm.phone} onChange={setEdit('phone')} placeholder="+91..." />
                            </div>
                            <div>
                              <label className="label">Registration No.</label>
                              <input className="input" value={editForm.registrationNo} onChange={setEdit('registrationNo')} />
                            </div>
                            <div>
                              <label className="label">Photo URL</label>
                              <input className="input" value={editForm.photoUrl} onChange={setEdit('photoUrl')} placeholder="https://..." />
                            </div>
                            <div className="col-span-2">
                              <label className="label">Bio</label>
                              <textarea className="input min-h-[72px] resize-y" value={editForm.bio} onChange={setEdit('bio')} placeholder="Short description shown on the booking page…" />
                            </div>
                          </div>
                        </>
                      )}

                      {editError && <p className="text-xs text-red-600">{editError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(s.id)} disabled={editSaving}
                          className="text-xs bg-teal text-white px-4 py-1.5 rounded-lg hover:bg-teal/90 transition-colors">
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={cancelEdit}
                          className="text-xs text-muted hover:text-ink px-3 py-1.5 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal row ── */
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-sm">{s.full_name}</p>
                        <p className="text-xs text-muted">{s.email} · <span className="capitalize">{s.role}</span></p>
                        {s.role === 'doctor' && s.specialization && (
                          <p className="text-xs text-teal mt-0.5">{s.display_name} · {s.specialization}</p>
                        )}
                        <p className="text-xs text-muted mt-0.5">
                          Registered {new Date(s.created_at).toLocaleDateString()}
                          {s.last_login_at && ` · Last login ${new Date(s.last_login_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusPill(s.status)}
                        <button onClick={() => startEdit(s)}
                          className="text-xs bg-surface border border-border text-ink px-3 py-1.5 rounded-lg hover:bg-teal-light hover:border-teal transition-colors">
                          Edit
                        </button>
                        {s.status === 'pending' && (
                          <button onClick={() => handleStatusChange(s.id, 'active')}
                            className="text-xs bg-teal text-white px-3 py-1.5 rounded-lg hover:bg-teal/90 transition-colors">
                            Approve
                          </button>
                        )}
                        {s.status === 'active' && (
                          <button onClick={() => handleStatusChange(s.id, 'suspended')}
                            className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors">
                            Suspend
                          </button>
                        )}
                        {s.status === 'suspended' && (
                          <button onClick={() => handleStatusChange(s.id, 'active')}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition-colors">
                            Reactivate
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Account */}
      {tab === 'create' && (
        <div className="max-w-md card">
          <h3 className="font-medium text-sm mb-4">Create Staff Account (Active immediately)</h3>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={form.fullName} onChange={set('fullName')} placeholder="Dr. Anil Sharma" required />
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required minLength={8} />
            </div>
            <div>
              <label className="label">Role *</label>
              <select className="input" value={form.role} onChange={set('role')}>
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {createSuccess && <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">{createSuccess}</p>}
            {createError && <p className="text-red-600 text-sm">{createError}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Creating…' : '👥 Create Account'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
