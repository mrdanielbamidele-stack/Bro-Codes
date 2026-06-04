import { useState, useCallback, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import Header from './components/Header'
import Toast from './components/Toast'
import Modal from './components/Modal'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { session, profile, loading, signUp, signIn, signOut, refreshProfile } = useAuth()
  const [view, setView] = useState('landing')
  const [authMode, setAuthMode] = useState('signup')
  const [toast, setToast] = useState({ visible: false, title: '', message: '', type: 'success' })
  const [modal, setModal] = useState({ visible: false, title: '', text: '', icon: null })
  const toastTimer = useRef(null)

  function showToast({ title, message, type = 'success' }) {
    clearTimeout(toastTimer.current)
    setToast({ visible: true, title, message, type })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3400)
  }

  function openAuth(mode = 'signup') {
    setAuthMode(mode)
    setView('auth')
  }

  async function handleAuth(mode, email, password, name) {
    if (mode === 'signup') {
      const data = await signUp(email, password, name)
      // Supabase returns no session when email confirmation is required
      if (!data?.session) {
        setView('verify-email')
        return
      }
      showToast({ title: 'Account created!', message: `Welcome to Recyclify, ${name}!` })
    } else {
      await signIn(email, password)
      showToast({ title: 'Logged in', message: 'Welcome back!' })
    }
    setView('dashboard')
  }

  async function handleSignOut() {
    await signOut()
    setView('landing')
    showToast({ title: 'Logged out', message: 'See you next time!' })
  }

  function scrollToHow() {
    setView('landing')
    setTimeout(() => {
      document.getElementById('how-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--muted)' }}>
        {/* spinner: rotating leaf icon */}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }} aria-label="Loading">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
      </div>
    )
  }

  return (
    <>
      <Header
        view={view}
        setView={setView}
        session={session}
        profile={profile}
        onSignUp={() => openAuth('signup')}
        onSignOut={handleSignOut}
      />

      <main>
        {view === 'landing' && (
          <Landing
            onStart={() => session ? setView('dashboard') : openAuth('signup')}
            onHowItWorks={scrollToHow}
          />
        )}

        {view === 'auth' && (
          <Auth
            mode={authMode}
            onSuccess={handleAuth}
          />
        )}

        {view === 'verify-email' && (
          <div style={{ display: 'grid', placeItems: 'center', height: '60vh', textAlign: 'center', padding: '0 24px' }}>
            <div>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 className="display" style={{ fontSize: 26, marginBottom: 10 }}>Check your email</h2>
              <p style={{ color: 'var(--muted)', maxWidth: 360, margin: '0 auto 24px' }}>
                We sent a confirmation link to your inbox. Click it to activate your account, then log in here.
              </p>
              <button className="btn btn-primary" onClick={() => openAuth('login')}>
                Go to login
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' && session && (
          <Dashboard
            session={session}
            profile={profile}
            onRefreshProfile={refreshProfile}
            showToast={showToast}
          />
        )}
      </main>

      <footer>
        {/* recycling arrows icon in footer */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M8 16H3v5" />
        </svg>
        Recyclify — Topfaith University Campus Clean-up Initiative · MVP
      </footer>

      <Toast toast={toast} />
      <Modal modal={modal} onClose={() => setModal(m => ({ ...m, visible: false }))} />
    </>
  )
}
