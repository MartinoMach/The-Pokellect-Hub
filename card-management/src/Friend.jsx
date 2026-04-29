import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DynamicBackground from './DynamicBackground.jsx';
import { getProfile } from './api.js';
import './Profile.css';
import './Collection.css'; // Inherit grid and empty state styles

// Helper to bypass strict image hotlinking (403 Forbidden)
const getProxiedImageUrl = (url) => {
  if (!url) return '/logo.png';
  if (url.startsWith('/')) return url; // Local assets
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
};

function Friend() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [binderCards, setBinderCards] = useState([]);
  const [isBinderHidden, setIsBinderHidden] = useState(false);
  const [error, setError] = useState('');

  // Fallback gracefully if someone navigates directly to /friend without state
  const friendUsername = location.state?.username || 'Unknown Trainer';
  const friendDisplayName = location.state?.displayName || friendUsername;
  const friendBio = location.state?.bio || 'Card collector & TCG enthusiast.';

  useEffect(() => {
    const loadFriendProfile = async () => {
      if (!location.state?.username) {
        setError('No user specified. Please select a friend from your profile.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await getProfile(location.state.username);
        setIsBinderHidden(data.isBinderHidden);
        setBinderCards(data.binder || []);
      } catch (err) {
        console.error("Failed to load friend profile:", err);
        setError('Failed to load profile. They may no longer exist.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFriendProfile();
  }, [location.state]);

  return (
    <div className="profile-container dashboard-container">
      <DynamicBackground />

      {/* Glass Navbar */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="nav-logo" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
            <img src="/logo.png" alt="Pokéllect logo" id="nav-logo-img" />
            <span id="nav-title">Pokéllect</span>
          </div>

          <div className="nav-links">
            <button className="nav-link-btn" onClick={() => navigate('/home')}>Home</button>
            <button className="nav-link-btn" onClick={() => navigate('/collection')}>Collection</button>
            <button className="nav-link-btn" onClick={() => navigate('/database')}>Card Database</button>
            <button className="nav-link-btn active" onClick={() => navigate('/profile')}>Friends</button>
          </div>

          <div className="nav-actions">
            <button className="btn-profile" onClick={() => navigate('/profile')}>
              <img src="/pp.png" alt="Profile Icon" className="profile-icon" />
              Profile
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="profile-content">

        <button className="btn-cancel" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/profile')}>
          ← Back to Friends
        </button>

        {/* Top Profile Header Card */}
        <div className="profile-header-card">
          <div className="profile-info-section">
            <img src="/pp.png" alt="User Avatar" className="profile-avatar-large" />
            <div className="profile-details">
              <h1 className="profile-username">{friendDisplayName}</h1>
              <p className="profile-bio">@{friendUsername} • {friendBio}</p>
            </div>
          </div>
        </div>

        <div className="profile-body">
          <section className="profile-stats">
            <div className="stat-box">
              <span className="stat-value">{isBinderHidden ? '?' : (isLoading ? "..." : binderCards.length)}</span>
              <span className="stat-label">Cards Collected</span>
            </div>
          </section>

          <section className="profile-friends">
            <h2 className="section-title-small">{friendDisplayName}'s Binder</h2>

            <div className="cards-grid" style={{ marginTop: '1.5rem' }}>
              {isLoading ? (
                <div className="skeleton-grid">
                  {[1, 2, 3, 4].map(n => <div key={n} className="skeleton-card"></div>)}
                </div>
              ) : error ? (
                <div className="empty-state">
                  <span className="empty-icon">⚠️</span>
                  <h3>Error</h3>
                  <p>{error}</p>
                </div>
              ) : isBinderHidden ? (
                <div className="empty-state">
                  <span className="empty-icon">🔒</span>
                  <h3>Private Binder</h3>
                  <p>This user has chosen to keep their binder private.</p>
                </div>
              ) : binderCards.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">🎴</span>
                  <h3>No cards yet</h3>
                  <p>This user hasn't added any cards to their binder.</p>
                </div>
              ) : (
                binderCards.map((card, idx) => (
                  <div key={card.id || idx} className="collection-card">
                    <img src={card.imageUrl || '/logo.png'} alt={card.cardName || card.name} className="collection-card-img" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(card.imageUrl); }} />
                    <h4>{card.cardName || card.name}</h4>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Friend;
