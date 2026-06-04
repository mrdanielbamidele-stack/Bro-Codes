import { useState } from 'react'
import LeafIcon from '../components/svgs/LeafIcon'

export default function Auth({ mode: initialMode, onSuccess, onSwitch }) {
  const [mode, setMode] = useState(initialMode || 'signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    if (isSignup && !name) { setError('Please enter your name.'); return }
    setLoading(true)
    try {
      await onSuccess(mode, email, password, name || email.split('@')[0])
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setMode(m => m === 'signup' ? 'login' : 'signup')
    setError('')
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="leaf-logo">
            <LeafIcon size={18} color="#06241a" />
          </div>
          <span style={{ fontFamily: "'Clash Display',sans-serif", fontWeight: 600 }}>Recyclify</span>
        </div>

        <h2 className="display" style={{ fontSize: 28, marginBottom: 6 }}>
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 14 }}>
          {isSignup ? 'Start earning green points in seconds.' : 'Log in to your green balance.'}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div>
              <label>Username</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Mr Eco Pulse"
                autoComplete="name"
              />
            </div>
          )}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="johndoe@gmail.com"
            autoComplete="email"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 22, padding: 14 }}
            disabled={loading}
          >
            {loading
              ? (isSignup ? 'Creating account…' : 'Logging in…')
              : (isSignup ? 'Sign up & start' : 'Log in')
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, color: 'var(--muted)', fontSize: 14 }}>
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <a
            style={{ color: 'var(--lime)', cursor: 'pointer', fontWeight: 600, textDecoration: 'none' }}
            onClick={switchMode}
          >
            {isSignup ? 'Log in' : 'Create account'}
          </a>
        </p>
      </div>
    </div>
  )
}
