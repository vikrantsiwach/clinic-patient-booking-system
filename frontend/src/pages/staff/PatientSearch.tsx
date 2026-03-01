import { useState } from 'react';
import StaffShell from '../../components/layout/StaffShell';
import { searchPatients } from '../../services/api';

export default function PatientSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.length < 2) return;
    setLoading(true);
    try {
      const res = await searchPatients(query);
      setResults(res.data.patients);
      setSearched(true);
    } catch {}
    setLoading(false);
  };

  return (
    <StaffShell>
      <h2 className="font-serif text-2xl mb-6">Patient Search</h2>
      <form onSubmit={search} className="flex gap-3 mb-6">
        <input
          className="input flex-1"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or phone number…"
        />
        <button type="submit" disabled={loading || query.length < 2} className="btn-primary px-6">
          {loading ? '…' : '🔍 Search'}
        </button>
      </form>

      {searched && results.length === 0 && (
        <div className="card text-center py-10 text-muted">No patients found for "{query}"</div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-sm text-muted">{p.phone}{p.email ? ` · ${p.email}` : ''}</p>
                  {p.date_of_birth && <p className="text-xs text-muted mt-0.5">DOB: {p.date_of_birth}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-teal">{p.visit_count} visit{p.visit_count !== 1 ? 's' : ''}</p>
                  {p.last_visit_date && <p className="text-xs text-muted">Last: {p.last_visit_date}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
