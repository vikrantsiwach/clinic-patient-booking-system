import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem { label: string; path: string; icon: string; roles: string[]; }

const NAV: NavItem[] = [
  { label: "Today's Queue",    path: '/staff/dashboard',             icon: '📅', roles: ['admin','doctor','receptionist'] },
  { label: 'Walk-in Booking',  path: '/staff/walkin',                icon: '🚶', roles: ['admin','doctor','receptionist'] },
  { label: 'Emergency Token',  path: '/staff/walkin?emergency=1',    icon: '⚡', roles: ['admin','doctor','receptionist'] },
  { label: 'Patient Search',   path: '/staff/patients',              icon: '🔍', roles: ['admin','doctor','receptionist'] },
  { label: 'My Profile',       path: '/staff/profile',               icon: '👤', roles: ['admin','doctor','receptionist'] },
  { label: 'Schedule Config',  path: '/admin/schedule',              icon: '⚙️', roles: ['admin','doctor','receptionist'] },
  { label: 'Blocked Dates',    path: '/admin/blocked-dates',         icon: '🚫', roles: ['admin','doctor','receptionist'] },
  { label: 'Reports',          path: '/admin/reports',               icon: '📊', roles: ['admin','doctor','receptionist'] },
  { label: 'Clinic Settings',  path: '/admin/settings',              icon: '🏥', roles: ['admin'] },
  { label: 'Staff Management', path: '/admin/staff',                 icon: '👥', roles: ['admin'] },
  { label: 'Missed Call Panel',path: '/admin/missed-call',           icon: '📞', roles: ['admin'] },
  { label: 'Blacklist',        path: '/admin/missed-call/blacklist', icon: '🚷', roles: ['admin'] },
];

export default function StaffShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userRole  = localStorage.getItem('userRole')  || 'receptionist';
  const userName  = localStorage.getItem('userName')  || 'Staff';
  const userPhoto = localStorage.getItem('userPhoto') || '';

  const handleLogout = () => {
    ['token','userRole','userName','doctorId','userPhoto'].forEach(k => localStorage.removeItem(k));
    navigate('/login');
  };

  const visibleNav = NAV.filter((n) => n.roles.includes(userRole));

  return (
    <div className="flex min-h-screen" style={{ background: '#EEF2EF' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-ink text-white flex flex-col sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-6 border-b border-white/10">
          <div className="w-9 h-9 bg-teal rounded-xl flex items-center justify-center text-lg mb-3">🏥</div>
          <h1 className="font-serif text-sm leading-snug">Clinic Appointment<br />System</h1>
          <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">{userRole}</p>
        </div>

        <nav className="flex-1 py-4">
          {visibleNav.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm transition-all border-l-[3px]
                ${(location.pathname + location.search) === item.path
                  ? 'bg-teal/25 border-teal text-white'
                  : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 flex items-center gap-3">
          {userPhoto
            ? <img src={userPhoto} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm shrink-0">👤</div>
          }
          <div className="min-w-0 flex-1">
            <div className="text-xs text-white/70 truncate">{userName}</div>
            <button onClick={handleLogout} className="text-xs text-white/40 hover:text-white transition-colors">
              Sign out →
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}
