import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../ui/ProgressBar';

interface Props { children: ReactNode; step?: number; title?: string; subtitle?: string; }

export default function PatientShell({ step, children, title, subtitle }: Props) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#EEF2EF] flex flex-col">
      {/* Header */}
      <header className="bg-ink text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center text-sm">🏥</div>
          <span className="font-serif text-sm leading-tight">Clinic<br />Appointment</span>
        </div>
        {step !== undefined && (
          <span className="text-xs text-white/40">Step {step + 1} of 4</span>
        )}
      </header>

      {/* Progress */}
      {step !== undefined && (
        <div className="bg-white border-b border-border px-6 py-3">
          <ProgressBar step={step} />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">
        {(title || subtitle) && (
          <div className="mb-6">
            {title && <h2 className="font-serif text-2xl text-ink mb-1">{title}</h2>}
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
