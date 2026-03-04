import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChannelPill } from '../../components/ui/StatusPill';
import { getAppointments, updateAppointmentStatus, addDoctorNotes, getDoctors } from '../../services/api';

type Tab = 'all' | 'booked' | 'arrived_waiting' | 'with_doctor' | 'completed' | 'cancelled' | 'no_show';

const STATUS_LABEL: Record<string, string> = {
  booked: 'Booked',
  arrived_waiting: 'Arrived & Waiting',
  with_doctor: 'With Doctor',
  completed: 'Completed',
  no_show: "No Show",
  cancelled: 'Cancelled',
};

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    booked: '#6b7280',
    arrived_waiting: '#0d9488',
    with_doctor: '#d97706',
    completed: '#16a34a',
    no_show: '#ef4444',
    cancelled: '#9ca3af',
  };
  return map[status] || '#6b7280';
}

function TabBtn({ tab, label, count, active, onClick }: { tab: Tab; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl font-medium transition-colors whitespace-nowrap
        ${active ? 'bg-teal text-white' : 'bg-white text-muted hover:text-ink'}`}
    >
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-muted'}`}>
        {count}
      </span>
    </button>
  );
}

export default function QueueDashboard() {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('en-CA');
  const userRole  = localStorage.getItem('userRole')  || 'receptionist';
  const myDoctorId = localStorage.getItem('doctorId') || '';

  // Dates (doctor/admin only)
  const [from, setFrom] = useState(today);
  const [to, setTo]     = useState(today);

  // Doctor picker (receptionist/admin)
  const [doctors, setDoctors] = useState<{ id: string; display_name: string }[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');

  // Data
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  // Notes modal
  const [notesModal, setNotesModal] = useState<{ id: string; current: string } | null>(null);
  const [notesText, setNotesText] = useState('');

  // Load doctors list for picker
  useEffect(() => {
    if (userRole !== 'doctor') {
      getDoctors().then(r => {
        setDoctors(r.data.doctors);
        if (r.data.doctors.length === 1) setSelectedDoctor(r.data.doctors[0].id);
      }).catch(() => {});
    }
  }, [userRole]);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | undefined> = {};
    if (userRole === 'doctor') {
      params.from = from;
      params.to = to;
    } else if (userRole === 'admin') {
      params.from = from;
      params.to = to;
      if (selectedDoctor) params.doctorId = selectedDoctor;
    } else {
      // receptionist: today only
      if (selectedDoctor) params.doctorId = selectedDoctor;
    }
    getAppointments(params)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userRole, from, to, selectedDoctor]);

  useEffect(() => { load(); }, [load]);

  const markStatus = async (id: string, status: string, reason?: string) => {
    try {
      await updateAppointmentStatus(id, status, reason);
      load();
    } catch (e) {
      alert((e as any).response?.data?.message || 'Failed to update');
    }
  };

  const promptCancel = (id: string) => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason !== null) markStatus(id, 'cancelled', reason || 'Cancelled by staff');
  };

  const saveNotes = async () => {
    if (!notesModal) return;
    try {
      await addDoctorNotes(notesModal.id, notesText);
      setNotesModal(null);
      load();
    } catch (e) {
      alert((e as any).response?.data?.message || 'Failed to save notes');
    }
  };

  const allAppts: any[] = data?.appointments || [];
  const stats = data?.stats || {};

  // Client-side search filter
  const filtered = allAppts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.patient_name?.toLowerCase().includes(q) || a.patient_phone?.includes(q);
  });

  const tabAppts = activeTab === 'all' ? filtered : filtered.filter(a => a.status === activeTab);

  const showDoctorPicker = userRole !== 'doctor' && doctors.length > 1;
  const showDateRange    = userRole !== 'receptionist';
  const canAddNotes      = userRole === 'doctor' || userRole === 'admin';

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-serif text-2xl">Queue</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {showDoctorPicker && (
            <select
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
              className="input text-sm py-2 w-auto"
            >
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
            </select>
          )}
          {showDateRange ? (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-2 w-auto" />
              <span className="text-muted text-sm">–</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-2 w-auto" />
            </>
          ) : (
            <div className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</div>
          )}
          <button onClick={() => navigate('/staff/walkin')} className="btn-primary text-sm py-2 px-4">+ Walk-in</button>
          <button onClick={() => navigate('/staff/walkin?emergency=1')} className="text-sm bg-red-500 text-white font-medium px-3 py-2 rounded-xl hover:bg-red-600 transition-colors">⚡ Emergency</button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by patient name or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="input text-sm mb-4 w-full max-w-sm"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <TabBtn tab="all"             label="All"              count={filtered.length}                                          active={activeTab==='all'}             onClick={() => setActiveTab('all')} />
        <TabBtn tab="booked"          label="Booked"           count={filtered.filter(a=>a.status==='booked').length}           active={activeTab==='booked'}          onClick={() => setActiveTab('booked')} />
        <TabBtn tab="arrived_waiting" label="Arrived & Waiting" count={filtered.filter(a=>a.status==='arrived_waiting').length} active={activeTab==='arrived_waiting'} onClick={() => setActiveTab('arrived_waiting')} />
        <TabBtn tab="with_doctor"     label="With Doctor"      count={filtered.filter(a=>a.status==='with_doctor').length}      active={activeTab==='with_doctor'}     onClick={() => setActiveTab('with_doctor')} />
        <TabBtn tab="completed"       label="Completed"        count={filtered.filter(a=>a.status==='completed').length}        active={activeTab==='completed'}       onClick={() => setActiveTab('completed')} />
        <TabBtn tab="cancelled"       label="Cancelled"        count={filtered.filter(a=>a.status==='cancelled').length}        active={activeTab==='cancelled'}       onClick={() => setActiveTab('cancelled')} />
        <TabBtn tab="no_show"         label="No Show"          count={filtered.filter(a=>a.status==='no_show').length}          active={activeTab==='no_show'}         onClick={() => setActiveTab('no_show')} />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}</div>
      ) : tabAppts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No appointments here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tabAppts.map((a: any) => {
            const isTerminal = ['completed', 'cancelled', 'no_show'].includes(a.status);
            return (
              <div
                key={a.id}
                className={`bg-white rounded-2xl p-4 shadow-card transition-all border-l-4
                  ${a.is_emergency ? 'border-red-500' : 'border-teal-mid'}
                  ${isTerminal ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl
                    ${a.is_emergency ? 'bg-red-100 text-red-600' : 'bg-teal-light text-teal'}`}>
                    {a.is_emergency ? 'E' : `#${a.token_number}`}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink">{a.patient_name}</p>
                      <ChannelPill channel={a.booking_channel} />
                      {a.is_emergency && <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-0.5 rounded">Emergency</span>}
                    </div>
                    <p className="text-xs text-muted">
                      {a.patient_phone}
                      {a.patient_age ? ` · ${a.patient_age} yrs` : ''}
                      {a.doctor_name ? ` · ${a.doctor_name}` : ''}
                    </p>
                    {a.reason_for_visit && <p className="text-xs text-label mt-0.5 truncate">{a.reason_for_visit}</p>}
                    <p className="text-xs font-medium mt-1" style={{ color: getStatusColor(a.status) }}>
                      {STATUS_LABEL[a.status] || a.status}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0 items-end">
                    {a.status === 'booked' && (
                      <button onClick={() => markStatus(a.id, 'arrived_waiting')}
                        className="text-xs bg-teal/10 text-teal font-medium px-3 py-1.5 rounded-lg hover:bg-teal/20 transition-colors whitespace-nowrap">
                        Mark Arrived →
                      </button>
                    )}
                    {a.status === 'arrived_waiting' && (
                      <button onClick={() => markStatus(a.id, 'with_doctor')}
                        className="text-xs bg-amber/10 text-amber font-medium px-3 py-1.5 rounded-lg hover:bg-amber/20 transition-colors whitespace-nowrap">
                        With Doctor →
                      </button>
                    )}
                    {a.status === 'with_doctor' && (
                      <button onClick={() => markStatus(a.id, 'completed')}
                        className="text-xs bg-green-50 text-green-700 font-medium px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap">
                        Complete ✓
                      </button>
                    )}

                    {!isTerminal && (
                      <>
                        {['booked','arrived_waiting','with_doctor'].includes(a.status) && (
                          <button onClick={() => promptCancel(a.id)}
                            className="text-xs text-red-400 hover:text-red-600 px-3 py-1 transition-colors">
                            Cancel
                          </button>
                        )}
                        {['booked','arrived_waiting'].includes(a.status) && (
                          <button onClick={() => { if (window.confirm("Mark as No Show?")) markStatus(a.id, 'no_show'); }}
                            className="text-xs text-amber hover:text-amber/80 px-3 py-1 transition-colors whitespace-nowrap">
                            No Show
                          </button>
                        )}
                      </>
                    )}

                    {canAddNotes && (
                      <button onClick={() => { setNotesModal({ id: a.id, current: a.doctor_notes || '' }); setNotesText(a.doctor_notes || ''); }}
                        className="text-xs text-muted hover:text-ink px-3 py-1 transition-colors">
                        {a.doctor_notes ? '📝 Notes' : '+ Notes'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Doctor Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-serif text-lg mb-3">Doctor Notes</h3>
            <textarea
              className="input w-full h-40 resize-none text-sm"
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Enter clinical notes…"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setNotesModal(null)} className="text-sm text-muted hover:text-ink px-4 py-2">Cancel</button>
              <button onClick={saveNotes} className="btn-primary text-sm px-4 py-2">Save Notes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
