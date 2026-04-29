import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import DynamicBackground from './DynamicBackground.jsx'
import { useData } from './DataContext.jsx'
import { searchUsers } from './api.js'
import './Profile.css'
import './Collection.css' // Import for glass-dialog styles

function Profile() {
  const navigate = useNavigate();
  const { binderCards, isLoading } = useData();
  const [username, setUsername] = useState('');
  const [friends, setFriends] = useState([]);

  // Add Friend Modal State
  const addFriendDialogRef = useRef(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Preview User Modal State
  const previewUserDialogRef = useRef(null);
  const [previewUser, setPreviewUser] = useState(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }

    // Load friends from local storage, default to an empty array if none exist
    const savedFriends = JSON.parse(localStorage.getItem('friends') || '[]');
    setFriends(savedFriends);
  }, []); // The empty dependency array ensures this runs only once

  // Debounced search for users in the database
  useEffect(() => {
    const fetchUsers = async () => {
      setIsSearchingUsers(true);
      try {
        const res = await searchUsers(friendSearchQuery);
        setUserSearchResults(res.users || []);
      } catch (err) {
        console.error("Failed to search users:", err);
        setUserSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    const handler = setTimeout(fetchUsers, 300); // 300ms debounce
    return () => clearTimeout(handler);
  }, [friendSearchQuery]);

  const handleLogout = () => {
    // Clear authentication tokens and securely log the user out
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleOpenAddFriendModal = () => {
    setFriendSearchQuery('');
    addFriendDialogRef.current.showModal();
  };

  const handlePreviewUser = (user) => {
    setPreviewUser(user);
    previewUserDialogRef.current.showModal();
  };

  const confirmAddFriend = () => {
    if (!previewUser) return;
    const friendUsername = previewUser.username;
    if (!friends.includes(friendUsername) && friendUsername !== username) {
      const updatedFriends = [...friends, friendUsername];
      setFriends(updatedFriends);
      localStorage.setItem('friends', JSON.stringify(updatedFriends));
    }
    previewUserDialogRef.current.close();
  };

  const handleRemoveFriend = (friendUsername, e) => {
    e.stopPropagation(); // Prevent the click from navigating to the friend's page
    if (window.confirm(`Are you sure you want to remove ${friendUsername} from your friends list?`)) {
      const updatedFriends = friends.filter(f => f !== friendUsername);
      setFriends(updatedFriends);
      localStorage.setItem('friends', JSON.stringify(updatedFriends));
    }
  };

  return (
    <div className="profile-container">
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
            <button className="nav-link-btn" onClick={() => navigate('/profile')}>Friends</button>
          </div>

          <div className="nav-actions">
            <button className="btn-profile active" onClick={() => navigate('/profile')}>
              <img src="/pp.png" alt="Profile Icon" className="profile-icon" />
              Profile
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="profile-content">

        {/* Top Profile Header Card */}
        <div className="profile-header-card">
          <div className="profile-info-section">
            <img src="/pp.png" alt="User Avatar" className="profile-avatar-large" />
            <div className="profile-details">
              <h1 className="profile-username">{username || 'User'}</h1>
              <p className="profile-bio">Card collector & TCG enthusiast.</p>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Log Out</button>
        </div>

        <div className="profile-body">
          {/* Stats Section */}
          <section className="profile-stats">
            <div className="stat-box">
              <span className="stat-value">{isLoading ? "..." : binderCards.length}</span>
              <span className="stat-label">Cards Collected</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{friends.length}</span>
              <span className="stat-label">Friends</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">$0.00</span>
              <span className="stat-label">Est. Vault Value</span>
            </div>
          </section>

          {/* Friends Grid Section */}
          <section className="profile-friends">
            <h2 className="section-title-small">Friends</h2>
            <div className="friends-grid">
              {friends.map((friend, index) => (
                <div key={index} className="friend-card" onClick={() => navigate('/friend', { state: { username: friend } })} style={{ position: 'relative' }}>
                  <button
                    className="remove-friend-btn"
                    onClick={(e) => handleRemoveFriend(friend, e)}
                    title="Remove friend"
                    style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255, 60, 60, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 2 }}
                  >
                    ×
                  </button>
                  <img src="/pp.png" alt={friend} className="friend-avatar" />
                  <span className="friend-name">{friend}</span>
                </div>
              ))}

              <div className="friend-card add-friend-card" onClick={handleOpenAddFriendModal}>
                <span className="add-friend-icon">+</span>
                <span className="friend-name">Add Friend</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Add Friend Search Modal */}
      <dialog ref={addFriendDialogRef} className="glass-dialog" onClose={() => setFriendSearchQuery('')}>
        <div className="dialog-content">
          <h2 className="dialog-title">Find Friends</h2>
          <p className="dialog-subtitle">Search the database for other collectors.</p>

          <input
            type="text"
            placeholder="Search by username..."
            className="dialog-input"
            value={friendSearchQuery}
            onChange={(e) => setFriendSearchQuery(e.target.value)}
          />

          <div className="search-results">
            {isSearchingUsers ? (
              <p className="no-results">Searching...</p>
            ) : userSearchResults.length === 0 ? (
              <p className="no-results">No users found.</p>
            ) : (
              userSearchResults.map((user, idx) => (
                <div key={idx} className="search-result-item" onClick={() => handlePreviewUser(user)}>
                  <img src="/pp.png" alt={user.username} className="result-img" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div className="result-details">
                    <span>{user.displayName || user.username}</span>
                    <small>@{user.username}</small>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dialog-actions">
            <button className="btn-cancel" onClick={() => addFriendDialogRef.current.close()}>Close</button>
          </div>
        </div>
      </dialog>

      {/* User Preview Modal */}
      <dialog ref={previewUserDialogRef} className="glass-dialog" onClose={() => setPreviewUser(null)}>
        {previewUser && (
          <div className="dialog-content stats-content">
            <img src="/pp.png" alt={previewUser.username} className="profile-avatar-large" style={{ margin: '0 auto 1rem', width: '100px', height: '100px' }} />

            <h2 className="dialog-title">{previewUser.displayName || previewUser.username}</h2>
            <p className="dialog-subtitle">@{previewUser.username}</p>
            <p style={{ color: '#d1d5db', marginBottom: '1.5rem', textAlign: 'center' }}>
              {previewUser.bio || 'Card collector & TCG enthusiast.'}
            </p>

            <div className="dialog-actions" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
              <button className="btn-cancel" onClick={() => navigate('/friend', { state: { username: previewUser.username, displayName: previewUser.displayName, bio: previewUser.bio } })}>View Profile</button>
              {!friends.includes(previewUser.username) ? (
                <button className="btn-submit dialog-btn" onClick={confirmAddFriend}>+ Add Friend</button>
              ) : (
                <button className="btn-submit dialog-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Friends ✓</button>
              )}
              <button className="btn-cancel" onClick={() => previewUserDialogRef.current.close()}>Close</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}

export default Profile
