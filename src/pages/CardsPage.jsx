import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function CardsPage() {
  const navigate = useNavigate();
  const [cards, setCards] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    api.getCards().then(setCards).catch((e) => {
      setError('Cards is not available right now. Please try again in a few minutes.');
      setErrorDetail(e?.message || '');
      setCards([]);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [c.name, c.job_title, c.company, c.website, c.address, c.notes, ...(c.emails || []), ...(c.phones || [])]
        .join(' ').toLowerCase().includes(q));
  }, [cards, query]);

  return (
    <div className="cards-page">
      <h1>Cards</h1>

      <div className="scan-actions">
        <button className="scan-btn" onClick={() => navigate('/cards/scan')}>Scan a card</button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {error && errorDetail && <p className="meta error-detail">Detail: {errorDetail}</p>}

      {cards && cards.length > 0 && (
        <input
          className="card-search"
          type="search"
          placeholder="Search name, company, email, phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {cards === null && <p className="meta">Loading…</p>}

      {cards && cards.length === 0 && !error && (
        <div className="empty-panel">
          <p className="meta">No cards yet. Scan a business card and its details will be saved here.</p>
          <Link className="link-accent" to="/cards/new">or add one by hand</Link>
        </div>
      )}

      {filtered.map((c) => (
        <Link key={c.id} to={`/cards/${c.id}`} className="card-row">
          {c.image_thumb
            ? <img className="card-thumb" src={c.image_thumb} alt="" />
            : <div className="card-thumb card-thumb-empty">{(c.name || c.company || '?').charAt(0).toUpperCase()}</div>}
          <div className="card-row-text">
            <strong>{c.name || c.company || 'Unnamed card'}</strong>
            <span>{[c.job_title, c.company && c.name ? c.company : ''].filter(Boolean).join(' · ') || (c.emails?.[0] ?? '')}</span>
          </div>
        </Link>
      ))}

      {cards && cards.length > 0 && filtered.length === 0 && <p className="meta">No cards match “{query}”.</p>}
    </div>
  );
}
