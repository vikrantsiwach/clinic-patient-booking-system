import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface Props { children: ReactNode; role: string; }

export default function ProtectedRoute({ children, role }: Props) {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('userRole');

  if (!token) {
    return <Navigate to={role === 'patient' ? '/' : '/login'} replace />;
  }

  if (role === 'admin' && userRole !== 'admin') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  if (role === 'staff' && !['admin', 'doctor', 'receptionist'].includes(userRole ?? '')) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
