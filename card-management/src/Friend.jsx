import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DynamicBackground from './DynamicBackground.jsx';
import { getProfile, getGlobalCards } from './api.js';
import './Profile.css';
import './Collection.css'; // Inherit grid and empty state styles
import CardDisplay from './CardDisplay.jsx';
import Footer from './Footer.jsx';

function Friend() {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: globalCards = [] } = useQuery({
    queryKey: ['globalCards'],
    queryFn: async () => {
      const res = await getGlobalCards();
      return Array.isArray(res) ? res : res.cards || [];
    }
  });

  const [binderCards, setBinderCards] = useState([]);
  const [isBinderHidden, setIsBinderHidden] = useState(false);
  const [error, setError] = useState('');
  const [friendAvatarUrl, setFriendAvatarUrl] = useState('/pp.png');

  // Fallback gracefully if someone navigates directly to /friend without state
  const friendTarget = location.state?.username;
  const [friendDisplayName, setFriendDisplayName] = useState(location.state?.displayName || friendTarget);
  const [friendBio, setFriendBio] = useState(location.state?.bio || '');

  const { data: friendData, isLoading, isError } = useQuery({
    queryKey: ['profile', friendTarget],
    queryFn: () => getProfile(friendTarget),
    enabled: !!friendTarget,
    retry: false
  });

  useEffect(() => {
    if (friendData) {
      setIsBinderHidden(friendData.isBinderHidden);
      setBinderCards(friendData.binder || []);
      setFriendAvatarUrl(friendData.user?.avatarUrl || '/pp.png');
      setFriendDisplayName(friendData.user?.displayName || friendTarget);
      setFriendBio(friendData.user?.bio || '');
    }
    if (isError || !friendTarget) {
      setError('Failed to load profile. They may no longer exist.');
    }
  }, [friendData, isError, friendTarget]);

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
            <button className="nav-link-btn" onClick={() => navigate('/social')}>Social</button>
          </div>

          <div className="nav-actions">
            <button className="btn-profile" onClick={() => navigate('/profile')}>
              <img src={sessionStorage.getItem('avatarUrl') || '/pp.png'} alt="Profile Icon" className="profile-icon" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />
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
            <img src={friendAvatarUrl} alt="User Avatar" className="profile-avatar-large" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />
            <div className="profile-details">
              <h1 className="profile-username">{friendDisplayName}</h1>
              <p className="profile-handle">@{friendTarget}</p>
              <div className="cool-bio-container">
                <span className="bio-label">Bio</span>
                <p className="cool-bio-text">{friendBio ? `"${friendBio}"` : ""}</p>
              </div>
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
            binderCards.map((card, idx) => {
              const fullStats = globalCards?.find(c => c.id === (card.globalCardId || card.id));
              const displayCard = fullStats ? { ...card, ...fullStats, id: card.id } : card;
              return (
                <CardDisplay
                  key={card.id || idx}
                  card={displayCard}
                />
              );
            })
              )}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Friend;
