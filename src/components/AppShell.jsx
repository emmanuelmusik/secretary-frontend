import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useI18n } from '../i18n/index.jsx';
import LanguageMenu from './LanguageMenu.jsx';
import { api } from '../lib/api.js';

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  // Close the menu whenever the page changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Which plan the person is on, shown under their email in the menu. Refreshed whenever the menu opens.
  const [plan, setPlan] = useState(null); // 'free' | 'pro' | 'unlimited'
  useEffect(() => {
    if (!menuOpen || !user) return;
    api.getUsage().then((u) => setPlan(u?.unlimited ? 'unlimited' : u?.plan === 'pro' ? 'pro' : 'free')).catch(() => {});
  }, [menuOpen, user]);

  // While the menu is open: Escape closes it, the page behind doesn't scroll,
  // and focus moves into the menu (then back to the menu button on close).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const opener = openerRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/auth');
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button
          ref={openerRef}
          type="button"
          className="menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label={t('menu.open')}
          aria-expanded={menuOpen}
        >
          <MenuIcon />
        </button>
        <NavLink to="/" className="app-brand" aria-label={t('nav.home_aria')}>
          <img src="/favicon.png" alt="" width="30" height="30" />
          <span>Secretary</span>
        </NavLink>
        <LanguageMenu />
      </header>

      <div className={`menu-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside
        className={`menu-drawer ${menuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.title')}
        aria-hidden={!menuOpen}
        inert={menuOpen ? undefined : ''}
      >
        <div className="menu-drawer-head">
          <div className="app-brand">
            <img src="/favicon.png" alt="" width="30" height="30" />
            <span>Secretary</span>
          </div>
          <button ref={closeRef} type="button" className="menu-btn" onClick={() => setMenuOpen(false)} aria-label={t('menu.close')}>
            <CloseIcon />
          </button>
        </div>

        {user?.email && <p className="menu-user">{user.email}</p>}
        {plan && <p className={`menu-plan menu-plan-${plan}`}>{t(`usage.${plan === 'pro' ? 'pro' : plan === 'unlimited' ? 'unlimited' : 'free'}`)}</p>}

        <nav className="menu-list">
          <MenuLink to="/" end icon="home">{t('nav.home')}</MenuLink>
          <MenuLink to="/folders" icon="folder">{t('nav.folders')}</MenuLink>
          <MenuLink to="/notes" icon="note">{t('nav.notes')}</MenuLink>
          <MenuLink to="/cards" icon="card">{t('nav.cards')}</MenuLink>

          <div className="menu-divider" />

          <MenuLink to="/account" icon="settings">{t('nav.settings')}</MenuLink>
          <MenuLink to="/support" icon="help">{t('nav.support')}</MenuLink>
          <MenuLink to="/privacy" icon="shield">{t('nav.privacy')}</MenuLink>

          <div className="menu-divider" />

          <button type="button" className="menu-item menu-signout" onClick={handleSignOut}>
            <TabIcon name="logout" />
            <span>{t('nav.logout')}</span>
          </button>
        </nav>
      </aside>

      <main className="app-content">{children}</main>

      <nav className="app-tabbar">
        <NavLink to="/" end className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="home" />
          <span>{t('nav.home')}</span>
        </NavLink>

        <NavLink to="/folders" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="folder" />
          <span>{t('nav.folders')}</span>
        </NavLink>

        <button className="tab-record-btn" onClick={() => navigate('/record')} aria-label={t('nav.record')}>
          <span className="tab-record-dot" />
        </button>

        <NavLink to="/notes" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="note" />
          <span>{t('nav.notes')}</span>
        </NavLink>

        <NavLink to="/cards" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="card" />
          <span>{t('nav.cards')}</span>
        </NavLink>
      </nav>
    </div>
  );
}

function MenuLink({ to, end, icon, children }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
      <TabIcon name={icon} />
      <span>{children}</span>
    </NavLink>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function TabIcon({ name }) {
  const paths = {
    home: <path d="M3 11L12 4l9 7v8a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-8z" />,
    folder: <path d="M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" />,
    note: <path d="M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM7 8h10M7 12h10M7 16h6" />,
    card: <path d="M3 6a1 1 0 011-1h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6zM7 10h5M7 14h3M15 10.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM14.5 15c.4-1 1-1.5 2-1.5s1.6.5 2 1.5" />,
    help: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" />,
    settings: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />,
    shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zM9 12l2 2 4-4" />,
    logout: <path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
