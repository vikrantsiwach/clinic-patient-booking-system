import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { staffLogin } from '../../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await staffLogin(email, password);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userRole', res.data.role);
      localStorage.setItem('userName', res.data.name);
      if (res.data.doctorId) localStorage.setItem('doctorId', res.data.doctorId);
      if (res.data.photoUrl) localStorage.setItem('userPhoto', res.data.photoUrl);
      navigate('/staff/dashboard');
    } catch (err) {
      setError((err as any).response?.data?.message || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#EEF2EF] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-ink rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">🏥</div>
          <h1 className="font-serif text-2xl">Clinic Staff Login</h1>
          <p className="text-sm text-muted mt-1">Sign in to access the dashboard</p>
        </div>

        <form onSubmit={login} className="card space-y-4">
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@clinic.local" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-4">
          <Link to="/" className="hover:text-teal transition-colors">← Patient Booking</Link>
        </p>
      </div>
    </div>
  );
}
