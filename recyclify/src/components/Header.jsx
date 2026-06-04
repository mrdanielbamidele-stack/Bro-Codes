import LeafIcon from './svgs/LeafIcon'

export default function Header({ view, setView, session, profile, onSignUp, onSignOut }) {
  return (
    <header>
      <div className="brand">
        <div className="leaf-logo">
          {/* brand mark: recycling arrows icon */}
          <LeafIcon size={20} color="#06241a" />
        </div>
        <b>Recyclify</b>
      </div>

      <nav className="nav-pill">
        <button
          className={view === 'landing' ? 'on' : ''}
          onClick={() => setView('landing')}
        >
          Home
        </button>
        <button
          className={view === 'dashboard' ? 'on' : ''}
          onClick={() => {
            if (!session) { onSignUp(); return }
            setView('dashboard')
          }}
        >
          Dashboard
        </button>
      </nav>

      <div className="top-right">
        {session   && (
          <div className="pts-chip">
            {/* points indicator in header */}
            <LeafIcon size={14} color="var(--lime)" />
            <span>{profile.points}</span> pts
          </div>
        )}
        {!session
          ? <button className="btn btn-primary" onClick={onSignUp}>Sign up</button>
          : <button className="btn btn-ghost" onClick={onSignOut}>Log out</button>
        }
      </div>
    </header>
  )
}
