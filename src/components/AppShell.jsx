import { NavLink, useNavigate } from 'react-router-dom';

export default function AppShell({ children }) {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="app-topbar-logo">Secretary</span>
        <NavLink to="/account" className="app-topbar-account">Account</NavLink>
      </header>

      <main className="app-content">{children}</main>

      <nav className="app-tabbar">
        <NavLink to="/" end className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="home" />
          <span>Home</span>
        </NavLink>

        <NavLink to="/folders" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="folder" />
          <span>Folders</span>
        </NavLink>

        <button className="tab-record-btn" onClick={() => navigate('/record')} aria-label="Record">
          <span className="tab-record-dot" />
        </button>

        <NavLink to="/notes" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="note" />
          <span>Notes</span>
        </NavLink>

        <NavLink to="/account" className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <TabIcon name="help" />
          <span>Account</span>
        </NavLink>
      </nav>
    </div>
  );
}

function TabIcon({ name }) {
  const paths = {
    home: <path d="M3 11L12 4l9 7v8a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-8z" />,
    folder: <path d="M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" />,
    note: <path d="M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM7 8h10M7 12h10M7 16h6" />,
    help: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
