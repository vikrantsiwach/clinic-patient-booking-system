import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import StaffShell from './components/layout/StaffShell';

// LandingPage loads eagerly — it's the entry point
import LandingPage from './pages/patient/LandingPage';

// All other pages are lazy-loaded (code-split into separate chunks)
const SessionPickerPage    = lazy(() => import('./pages/patient/SessionPickerPage'));
const PatientFormPage      = lazy(() => import('./pages/patient/PatientFormPage'));
const ReviewPage           = lazy(() => import('./pages/patient/ReviewPage'));
const ConfirmedPage        = lazy(() => import('./pages/patient/ConfirmedPage'));
const PatientDashboard     = lazy(() => import('./pages/patient/PatientDashboard'));
const MissedCallHowItWorks = lazy(() => import('./pages/patient/MissedCallHowItWorks'));

const LoginPage            = lazy(() => import('./pages/staff/LoginPage'));
const QueueDashboard       = lazy(() => import('./pages/staff/QueueDashboard'));
const WalkInBookingForm    = lazy(() => import('./pages/staff/WalkInBookingForm'));
const PatientSearch        = lazy(() => import('./pages/staff/PatientSearch'));
const MyProfile            = lazy(() => import('./pages/staff/MyProfile'));

const ClinicSettings       = lazy(() => import('./pages/admin/ClinicSettings'));
const ScheduleConfig       = lazy(() => import('./pages/admin/ScheduleConfig'));
const BlockedDates         = lazy(() => import('./pages/admin/BlockedDates'));
const StaffManagement      = lazy(() => import('./pages/admin/StaffManagement'));
const Reports              = lazy(() => import('./pages/admin/Reports'));
const MCAdminDashboard     = lazy(() => import('./pages/admin/missed-call/MCAdminDashboard'));
const MCBlacklist          = lazy(() => import('./pages/admin/missed-call/MCBlacklist'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#EEF2EF] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
    </div>
  );
}

function ContentLoader() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-6 h-6 rounded-full border-2 border-teal border-t-transparent animate-spin" />
    </div>
  );
}

// Persistent layout — StaffShell stays mounted across all child route navigations.
// Only the <Outlet /> (page content) swaps, so the sidebar never flashes.
function StaffLayout({ role = 'staff' }: { role?: 'staff' | 'admin' }) {
  return (
    <ProtectedRoute role={role}>
      <StaffShell>
        <Suspense fallback={<ContentLoader />}>
          <Outlet />
        </Suspense>
      </StaffShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Patient public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/book" element={<SessionPickerPage />} />
          <Route path="/book/details" element={<PatientFormPage />} />
          <Route path="/book/review" element={<ReviewPage />} />
          <Route path="/book/confirmed" element={<ConfirmedPage />} />
          <Route path="/missed-call" element={<MissedCallHowItWorks />} />
          <Route path="/my-appointments" element={<PatientDashboard />} />

          <Route path="/login" element={<LoginPage />} />

          {/* Staff — StaffShell persists, only content swaps on navigation */}
          <Route element={<StaffLayout role="staff" />}>
            <Route path="/staff/dashboard" element={<QueueDashboard />} />
            <Route path="/staff/walkin" element={<WalkInBookingForm />} />
            <Route path="/staff/patients" element={<PatientSearch />} />
            <Route path="/staff/profile" element={<MyProfile />} />
            <Route path="/admin/schedule" element={<ScheduleConfig />} />
            <Route path="/admin/blocked-dates" element={<BlockedDates />} />
            <Route path="/admin/reports" element={<Reports />} />
          </Route>

          {/* Admin only */}
          <Route element={<StaffLayout role="admin" />}>
            <Route path="/admin/settings" element={<ClinicSettings />} />
            <Route path="/admin/staff" element={<StaffManagement />} />
            <Route path="/admin/missed-call" element={<MCAdminDashboard />} />
            <Route path="/admin/missed-call/blacklist" element={<MCBlacklist />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
