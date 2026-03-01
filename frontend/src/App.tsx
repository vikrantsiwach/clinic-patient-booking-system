import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';

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

          {/* Patient — handles its own auth via OTP login form */}
          <Route path="/my-appointments" element={<PatientDashboard />} />

          {/* Staff */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/staff/dashboard" element={
            <ProtectedRoute role="staff"><QueueDashboard /></ProtectedRoute>
          } />
          <Route path="/staff/walkin" element={
            <ProtectedRoute role="staff"><WalkInBookingForm /></ProtectedRoute>
          } />
          <Route path="/staff/patients" element={
            <ProtectedRoute role="staff"><PatientSearch /></ProtectedRoute>
          } />
          <Route path="/staff/profile" element={
            <ProtectedRoute role="staff"><MyProfile /></ProtectedRoute>
          } />

          {/* Staff + Admin shared */}
          <Route path="/admin/schedule" element={
            <ProtectedRoute role="staff"><ScheduleConfig /></ProtectedRoute>
          } />
          <Route path="/admin/blocked-dates" element={
            <ProtectedRoute role="staff"><BlockedDates /></ProtectedRoute>
          } />
          <Route path="/admin/reports" element={
            <ProtectedRoute role="staff"><Reports /></ProtectedRoute>
          } />

          {/* Admin only */}
          <Route path="/admin/settings" element={
            <ProtectedRoute role="admin"><ClinicSettings /></ProtectedRoute>
          } />
          <Route path="/admin/staff" element={
            <ProtectedRoute role="admin"><StaffManagement /></ProtectedRoute>
          } />
          <Route path="/admin/missed-call" element={
            <ProtectedRoute role="admin"><MCAdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/missed-call/blacklist" element={
            <ProtectedRoute role="admin"><MCBlacklist /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
