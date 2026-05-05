import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from './api'
import DynamicBackground from './DynamicBackground.jsx'
import { useQueryClient } from '@tanstack/react-query'
import './Sign-Up.css'
import Footer from './Footer.jsx';

function SignUp() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      await register(username, password)
      queryClient.invalidateQueries() // Invalidate cache so everything is fresh
      navigate('/collection')
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="signup-container">
      {/* Dynamic Background Elements */}
      <DynamicBackground />

      <Link to="/" className="btn-back-nav">← Back to Home</Link>

      <div className="signup-box">
        <div className="signup-header">
          <img src="/logo.png" alt="Pokéllect logo" className="signup-logo" />
          <h1 className="signup-title">Pokéllect</h1>
        </div>

        <h2 className="signup-subtitle">Create an Account</h2>

        <form onSubmit={handleSignUp} className="signup-form">
          <input
            type='text'
            placeholder='Username'
            className='signup-input'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type='password'
            placeholder='Password'
            className='signup-input'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type='password'
            placeholder='Confirm Password'
            className='signup-input'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
          />

          {error && <p className="error-text">{error}</p>}

          <button className='btn-submit' type='submit' disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="login-prompt">
          Already have an account? <span onClick={() => navigate('/login')} className="login-link">Log in</span>
        </p>
      </div>

      <Footer />
    </div>
  )
}

export default SignUp
