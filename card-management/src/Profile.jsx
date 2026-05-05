import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import DynamicBackground from './DynamicBackground.jsx'
import { searchUsers, getProfile, updateProfile, getMyBinder, manageFriends } from './api.js'
import './Profile.css'
import './Collection.css' // Import for glass-dialog styles
import Footer from './Footer.jsx';

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');

  const { data: binderCards = [], isLoading } = useQuery({
    queryKey: ['binder', username],
    queryFn: async () => {
      if (!username) return [];
      const res = await getMyBinder(username);
      return Array.isArray(res) ? res : res.binder || [];
    },
    enabled: !!username
  });
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [displayName, setDisplayName] = useState(sessionStorage.getItem('displayName') || '');
  const [bio, setBio] = useState(sessionStorage.getItem('bio') || '');
  const [avatarUrl, setAvatarUrl] = useState(sessionStorage.getItem('avatarUrl') || '/pp.png');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // Automatically fetch profile data for all friends in the friends list
  const friendProfileQueries = useQueries({
    queries: friends.map((friend) => ({
      queryKey: ['profile', friend],
      queryFn: () => getProfile(friend),
      enabled: !!friend,
      retry: false,
    })),
  });

  const friendProfiles = friends.reduce((profiles, friend, index) => {
    const user = friendProfileQueries[index]?.data?.user;
    profiles[friend] = {
      displayName: user?.displayName || friend,
      avatarUrl: user?.avatarUrl || '/pp.png',
    };
    return profiles;
  }, {});

  // Add Friend Modal State
  const addFriendDialogRef = useRef(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Preview User Modal State
  const previewUserDialogRef = useRef(null);
  const [previewUser, setPreviewUser] = useState(null);
  
  // Remove Friend Modal State
  const removeFriendDialogRef = useRef(null);
  const [friendToRemove, setFriendToRemove] = useState(null);

  // Change Avatar Modal State
  const changeAvatarDialogRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      
      // Fetch the actual profile to get the user's custom bio
      getProfile(storedUsername)
        .then(data => {
          setDisplayName(data.user?.displayName || storedUsername);
          setBio(data.user?.bio || '');
          setAvatarUrl(data.user?.avatarUrl || '/pp.png');
          setFriends(data.user?.friends || []);
          setFriendRequests(data.user?.friendRequests || []);
          sessionStorage.setItem('displayName', data.user?.displayName || storedUsername);
          sessionStorage.setItem('bio', data.user?.bio || '');
          sessionStorage.setItem('avatarUrl', data.user?.avatarUrl || '/pp.png');
        })
        .catch(() => {
          setDisplayName(storedUsername);
          setBio('');
          setAvatarUrl('/pp.png');
          sessionStorage.setItem('displayName', storedUsername);
          sessionStorage.setItem('bio', '');
          sessionStorage.setItem('avatarUrl', '/pp.png');
        });
    }
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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('displayName');
    sessionStorage.removeItem('bio');
    sessionStorage.removeItem('avatarUrl');
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

  const confirmAddFriend = async () => {
    if (!previewUser) return;
    const friendUsername = previewUser.username;

    if (friends.includes(friendUsername) || friendUsername === username) return;

    // If they already sent us a request, automatically accept it instead!
    if (friendRequests.includes(friendUsername)) {
      handleAcceptRequest(friendUsername);
      previewUserDialogRef.current.close();
      return;
    }

    try {
      await manageFriends('send', username, friendUsername);
      previewUserDialogRef.current.close();
      alert(`Friend request sent to ${friendUsername}!`);
    } catch (err) {
      alert("Failed to send request.");
    }
  };

  const handleAcceptRequest = async (requester) => {
    try {
      await manageFriends('accept', username, requester);
      const updatedRequests = friendRequests.filter(r => r !== requester);
      setFriendRequests(updatedRequests);
      
      if (!friends.includes(requester)) {
        setFriends([...friends, requester]);
      }
    } catch (err) {
      alert("Failed to accept request.");
    }
  };

  const handleDeclineRequest = async (requester) => {
    try {
      await manageFriends('decline', username, requester);
      const updatedRequests = friendRequests.filter(r => r !== requester);
      setFriendRequests(updatedRequests);
    } catch (err) {
      alert("Failed to decline request.");
    }
  };

  const handleRemoveFriend = (friendUsername, e) => {
    e.stopPropagation(); // Prevent the click from navigating to the friend's page
    setFriendToRemove(friendUsername);
    removeFriendDialogRef.current.showModal();
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;

    try {
      await manageFriends('remove', username, friendToRemove);
      const updatedFriends = friends.filter(f => f !== friendToRemove);
      setFriends(updatedFriends);
      removeFriendDialogRef.current.close();
      setFriendToRemove(null);
    } catch (err) {
      alert("Failed to remove friend.");
    }
  };
  
  const handleOpenAvatarModal = () => {
    setNewAvatarUrl(''); // Clear previous selection
    if (fileInputRef.current) fileInputRef.current.value = '';
    changeAvatarDialogRef.current.showModal();
  };

  const handleSaveAvatar = async () => {
    setIsUpdatingAvatar(true);
    try {
      const finalUrl = newAvatarUrl.trim() || '/pp.png';
      await updateProfile({ username, avatarUrl: finalUrl });
      setAvatarUrl(finalUrl);
      sessionStorage.setItem('avatarUrl', finalUrl);
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      changeAvatarDialogRef.current.close();
    } catch (err) {
      alert("Failed to update profile picture: " + err.message);
    } finally {
      setIsUpdatingAvatar(false);
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
            <button className="nav-link-btn" onClick={() => navigate('/social')}>Social</button>
          </div>

          <div className="nav-actions">
            <button className="btn-profile active" onClick={() => navigate('/profile')}>
              <img src={avatarUrl} alt="Profile Icon" className="profile-icon" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />
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
            <div className="avatar-wrapper" onClick={handleOpenAvatarModal} title="Change Profile Picture">
              <img src={avatarUrl} alt="User Avatar" className="profile-avatar-large" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />
              <div className="avatar-overlay">
                <span>Edit</span>
              </div>
            </div>
            <div className="profile-details">
              <h1 className="profile-username">{displayName || username || 'User'}</h1>
              <p className="profile-handle">@{username}</p>
              <div className="cool-bio-container">
                <span className="bio-label">Bio</span>
                <p className="cool-bio-text">{bio ? `"${bio}"` : ""}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-cancel" onClick={() => navigate('/settings')}>⚙ Settings</button>
            <button className="btn-logout" onClick={handleLogout}>Log Out</button>
          </div>
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

          {/* Pending Friend Requests Section */}
          {friendRequests.length > 0 && (
            <section className="profile-friend-requests">
              <h2 className="section-title-small" style={{ borderBottom: 'none', paddingBottom: '0' }}>Friend Requests ({friendRequests.length})</h2>
              <div className="requests-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {friendRequests.map(req => (
                  <div key={req} className="friend-request-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.05rem', color: '#fff' }}><strong>@{req}</strong> sent you a friend request!</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-submit" style={{ padding: '0.4rem 1rem', width: 'auto', margin: 0 }} onClick={() => handleAcceptRequest(req)}>Accept</button>
                      <button className="btn-cancel" style={{ padding: '0.4rem 1rem', width: 'auto', margin: 0 }} onClick={() => handleDeclineRequest(req)}>Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Friends Grid Section */}
          <section className="profile-friends">
            <h2 className="section-title-small">Friends</h2>
            <div className="friends-grid">
              {friends.map((friend, index) => (
                <div key={index} className="friend-card" onClick={() => navigate('/friend', { state: { username: friend, displayName: friendProfiles[friend]?.displayName } })} style={{ position: 'relative' }}>
                  <button
                    className="remove-friend-btn"
                    onClick={(e) => handleRemoveFriend(friend, e)}
                    title="Remove friend"
                    style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(255, 60, 60, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 2 }}
                  >
                    ×
                  </button>
                  <img 
                    src={friendProfiles[friend]?.avatarUrl || '/pp.png'} 
                    alt={friend} 
                    className="friend-avatar" 
                    onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} 
                  />
                  <span className="friend-name">{friendProfiles[friend]?.displayName || friend}</span>
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
                  <img src={user.avatarUrl || '/pp.png'} alt={user.username} className="result-img" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />
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
            <img src={previewUser.avatarUrl || '/pp.png'} alt={previewUser.username} className="profile-avatar-large" style={{ margin: '0 auto 1rem', width: '100px', height: '100px' }} onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />

            <h2 className="dialog-title">{previewUser.displayName || previewUser.username}</h2>
            <p className="dialog-subtitle">@{previewUser.username}</p>
            <p style={{ color: '#d1d5db', marginBottom: '1.5rem', textAlign: 'center' }}>
              {previewUser.bio ? `"${previewUser.bio}"` : ""}
            </p>

            <div className="dialog-actions" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
              <button className="btn-cancel" onClick={() => navigate('/friend', { state: { username: previewUser.username, displayName: previewUser.displayName, bio: previewUser.bio } })}>View Profile</button>
              {previewUser.username === username ? (
                <button className="btn-submit dialog-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>This is you</button>
              ) : !friends.includes(previewUser.username) ? (
                friendRequests.includes(previewUser.username) ? (
                  <button className="btn-submit dialog-btn" onClick={() => { handleAcceptRequest(previewUser.username); previewUserDialogRef.current.close(); }}>Accept Request</button>
                ) : previewUser.friendRequests?.includes(username) ? (
                  <button className="btn-submit dialog-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Request Sent</button>
                ) : (
                  <button className="btn-submit dialog-btn" onClick={confirmAddFriend}>+ Add Friend</button>
                )
              ) : (
                <button className="btn-submit dialog-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Friends ✓</button>
              )}
              <button className="btn-cancel" onClick={() => previewUserDialogRef.current.close()}>Close</button>
            </div>
          </div>
        )}
      </dialog>

      {/* Remove Friend Confirmation Modal */}
      <dialog ref={removeFriendDialogRef} className="glass-dialog" onClose={() => setFriendToRemove(null)}>
        <div className="dialog-content">
          <h2 className="dialog-title">Remove Friend</h2>
          <p className="dialog-subtitle" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
            Are you sure you want to remove <strong>{friendToRemove}</strong> from your friends list?
          </p>

          <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
            <button className="btn-cancel" onClick={() => removeFriendDialogRef.current.close()}>Cancel</button>
            <button className="btn-remove dialog-btn" style={{ margin: 0 }} onClick={confirmRemoveFriend}>Remove Friend</button>
          </div>
        </div>
      </dialog>

      {/* Change Avatar Modal */}
      <dialog ref={changeAvatarDialogRef} className="glass-dialog" onClose={() => {
        setNewAvatarUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }}>
        <div className="dialog-content">
          <h2 className="dialog-title">Change Profile Picture</h2>
          <p className="dialog-subtitle">Choose an image from your device.</p>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="dialog-input"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                if (file.size > 5 * 1024 * 1024) { // Increased to 5MB, canvas will shrink it anyway
                  alert("Please select an image under 5MB.");
                  e.target.value = "";
                  return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 250; // Perfect size for a profile picture
                    let { width, height } = img;

                    // Maintain aspect ratio while shrinking
                    if (width > height && width > maxSize) {
                      height = Math.round((height * maxSize) / width);
                      width = maxSize;
                    } else if (height > maxSize) {
                      width = Math.round((width * maxSize) / height);
                      height = maxSize;
                    }
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    setNewAvatarUrl(canvas.toDataURL('image/jpeg', 0.85)); // Highly compressed JPEG
                  };
                  img.src = reader.result;
                };
                reader.readAsDataURL(file);
              }
            }}
          />

          {newAvatarUrl && newAvatarUrl.startsWith('data:') && (
            <img src={newAvatarUrl} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1rem', border: '2px solid #3b82f6', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }} />
          )}

          <div className="dialog-actions">
            <button className="btn-cancel" onClick={() => changeAvatarDialogRef.current.close()}>Cancel</button>
            <button className="btn-submit dialog-btn" onClick={handleSaveAvatar} disabled={isUpdatingAvatar || !newAvatarUrl}>
              {isUpdatingAvatar ? 'Saving...' : 'Save Avatar'}
            </button>
          </div>
        </div>
      </dialog>

      <Footer />
    </div>
  )
}

export default Profile
