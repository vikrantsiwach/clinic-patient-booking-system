import { useEffect, useState } from 'react';
import StaffShell from '../../components/layout/StaffShell';
import { getSchedule, updateSchedule, getDoctors } from '../../services/api';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

function makeDefaultDay(dayOfWeek: string) {
  return { dayOfWeek, isActive: false, sessions: [{ from: '09:00', to: '13:00', slot: 20, max: '' }] };
}

function sessionsFromSchedule(s: any) {
  if (s.sessions && s.sessions.length) {
    return s.sessions.map((sess: any) => ({ ...sess, max: sess.max != null ? sess.max : '' }));
  }
  const result = [];
  if (s.morningStart) result.push({ from: s.morningStart, to: s.morningEnd, slot: s.slotDurationMins || 20, max: '' });
  if (s.eveningStart) result.push({ from: s.eveningStart, to: s.eveningEnd, slot: s.slotDurationMins || 20, max: '' });
  return result.length ? result : [{ from: '09:00', to: '13:00', slot: 20, max: '' }];
}

export default function ScheduleConfig() {
  const userRole   = localStorage.getItem('userRole') || 'receptionist';
  const myDoctorId = localStorage.getItem('doctorId') || '';

  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState(userRole === 'doctor' ? myDoctorId : '');

  const [schedule, setSchedule] = useState(DAYS.map(makeDefaultDay));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Load doctors for picker (non-doctor roles)
  useEffect(() => {
    if (userRole !== 'doctor') {
      getDoctors().then(r => {
        const docs = r.data.doctors || [];
        setDoctors(docs);
        if (docs.length === 1) setSelectedDoctor(docs[0].id);
      }).catch(() => {});
    }
  }, [userRole]);

  // Load schedule when doctor changes
  useEffect(() => {
    if (userRole !== 'doctor' && !selectedDoctor) return;
    setLoading(true);
    getSchedule(selectedDoctor || undefined).then(r => {
      if (r.data.schedule?.length) {
        const map: Record<string, any> = {};
        r.data.schedule.forEach((s: any) => { map[s.dayOfWeek] = s; });
        setSchedule(DAYS.map(d => map[d]
          ? { dayOfWeek: d, isActive: map[d].isActive !== false, sessions: sessionsFromSchedule(map[d]) }
          : makeDefaultDay(d)
        ));
      } else {
        setSchedule(DAYS.map(makeDefaultDay));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedDoctor, userRole]);

  const updateDay = (idx: number, patch: Record<string, unknown>) =>
    setSchedule(s => s.map((d, i) => i === idx ? { ...d, ...patch } : d));

  const updateSession = (dayIdx: number, sessIdx: number, patch: Record<string, unknown>) =>
    setSchedule(s => s.map((d, i) => i !== dayIdx ? d : {
      ...d,
      sessions: d.sessions.map((sess, j) => j === sessIdx ? { ...sess, ...patch } : sess),
    }));

  const addSession = (dayIdx: number) =>
    setSchedule(s => s.map((d, i) => i !== dayIdx ? d : {
      ...d,
      sessions: [...d.sessions, { from: '17:00', to: '20:00', slot: 20, max: '' }],
    }));

  const removeSession = (dayIdx: number, sessIdx: number) =>
    setSchedule(s => s.map((d, i) => i !== dayIdx ? d : {
      ...d,
      sessions: d.sessions.filter((_, j) => j !== sessIdx),
    }));

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const days = schedule.filter(d => d.isActive).map(d => ({
        dayOfWeek: d.dayOfWeek,
        isActive: true,
        sessions: d.sessions.map(s => ({
          from: s.from,
          to: s.to,
          slot: s.slot,
          max: s.max === '' || s.max === null || s.max === undefined ? null : Number(s.max),
        })),
      }));
      await updateSchedule(days, selectedDoctor || undefined);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError((err as any)?.response?.data?.message || (err as any)?.response?.data?.error || 'Save failed. Please try again.');
    }
    setSaving(false);
  };

  return (
    <StaffShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-serif text-2xl">Schedule Configuration</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {userRole !== 'doctor' && doctors.length > 1 && (
            <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="input text-sm py-2 w-auto">
              <option value="">Select doctor…</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
            </select>
          )}
          {saveError && <span className="text-xs text-red-500">{saveError}</span>}
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Schedule'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{DAYS.map(d => <div key={d} className="card h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {schedule.map((day, dayIdx) => (
            <div key={day.dayOfWeek} className={`card transition-all ${!day.isActive ? 'opacity-60' : ''}`}>

              {/* Day header row */}
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={day.isActive}
                    onChange={e => updateDay(dayIdx, { isActive: e.target.checked })}
                    className="accent-teal w-4 h-4"
                  />
                  <span className="font-medium capitalize">{day.dayOfWeek}</span>
                </label>
                {day.isActive && day.sessions.length < 3 && (
                  <button
                    onClick={() => addSession(dayIdx)}
                    className="text-xs text-teal hover:text-teal/80 font-medium transition-colors"
                  >
                    + Add Session
                  </button>
                )}
              </div>

              {/* Session rows */}
              {day.isActive && (
                <div className="space-y-2 pl-6">
                  {day.sessions.map((sess, sessIdx) => (
                    <div key={sessIdx} className="flex flex-wrap items-end gap-3 bg-surface rounded-xl px-4 py-3 border border-border">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted w-8">From</span>
                        <input
                          type="time"
                          value={sess.from}
                          onChange={e => updateSession(dayIdx, sessIdx, { from: e.target.value })}
                          className="input text-xs py-1 w-28"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted w-4">To</span>
                        <input
                          type="time"
                          value={sess.to}
                          onChange={e => updateSession(dayIdx, sessIdx, { to: e.target.value })}
                          className="input text-xs py-1 w-28"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted">Slot</span>
                        <select
                          value={sess.slot}
                          onChange={e => updateSession(dayIdx, sessIdx, { slot: parseInt(e.target.value) })}
                          className="input text-xs py-1 w-20"
                        >
                          {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted">Max</span>
                          <input
                            type="number"
                            value={sess.max}
                            onChange={e => updateSession(dayIdx, sessIdx, { max: e.target.value })}
                            placeholder="∞"
                            className="input text-xs py-1 w-16"
                            min={1}
                          />
                        </div>
                        <span className="text-[10px] text-muted/70 pl-8">Leave empty for unlimited</span>
                      </div>
                      {day.sessions.length > 1 && (
                        <button
                          onClick={() => removeSession(dayIdx, sessIdx)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto self-center"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
