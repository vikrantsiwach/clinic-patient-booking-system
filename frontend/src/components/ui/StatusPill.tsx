interface PillStyle { label: string; cls: string }

const STATUS: Record<string, PillStyle> = {
  booked:    { label: 'Waiting',         cls: 'bg-blue-50 text-blue-600' },
  confirmed: { label: 'Called',          cls: 'bg-teal-light text-teal' },
  arrived:   { label: 'With Doctor',     cls: 'bg-amber/10 text-amber' },
  completed: { label: 'Completed',       cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Cancelled',       cls: 'bg-red-50 text-red-600' },
  no_show:   { label: "Didn't Show Up",  cls: 'bg-gray-100 text-gray-500' },
};

const CHANNEL: Record<string, PillStyle> = {
  online:      { label: '📅 Online',      cls: 'bg-teal-light text-teal' },
  missed_call: { label: '📞 Missed Call', cls: 'bg-orange-light text-orange' },
  walkin:      { label: '🚶 Walk-in',     cls: 'bg-purple-light text-purple' },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

export function ChannelPill({ channel }: { channel: string }) {
  const c = CHANNEL[channel] || { label: channel, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`pill ${c.cls}`}>{c.label}</span>;
}
