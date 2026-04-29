import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from './api'
import DynamicBackground from './DynamicBackground.jsx'
import { useData } from './DataContext.jsx'
import './Log-in.css'

function LogIn() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { loadData } = useData()

  const handleLogIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      await loadData() // Fetch collection data securely now that we have a token
      navigate('/home')
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      {/* Dynamic Background Elements */}
      <DynamicBackground />

      <Link to="/" className="btn-back-nav">← Back to Home</Link>

      <div className="login-box">
        <div className="login-header">
          <img src="/logo.png" alt="Pokéllect logo" className="login-logo" />
          <h1 className="login-title">Pokéllect</h1>
        </div>

        <h2 className="login-subtitle">Welcome Back!</h2>

        <form onSubmit={handleLogIn} className="login-form">
          <input
            type='text'
            placeholder='Username'
            className='login-input'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type='password'
            placeholder='Password'
            className='login-input'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />

          {error && <p className="error-text">{error}</p>}

          <button className='btn-submit' type='submit' disabled={loading}>
            {loading ? 'Signing In...' : 'Log In'}
          </button>
        </form>

        <p className="signup-prompt">
          Don't have an account? <span onClick={() => navigate('/signup')} className="signup-link">Sign up</span>
        </p>
      </div>
    </div>
  )
}

export default LogIn
