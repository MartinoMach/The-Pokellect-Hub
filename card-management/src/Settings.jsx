import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DynamicBackground from './DynamicBackground.jsx';
import { getProfile, updateProfile } from './api.js';
import './Collection.css'; // Inherit base UI tokens
import './Settings.css';
import Footer from './Footer.jsx';

function Settings() {
  const navigate = useNavigate();
  const currentUsername = sessionStorage.getItem('username');

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    bio: '',
    binderIsPrivate: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUsername) {
        navigate('/login');
        return;
      }
      
      try {
        const data = await getProfile(currentUsername);
        // Exclude passwords from initial load, populate the rest
        setFormData(prev => ({
          ...prev,
          username: data.user?.username || currentUsername,
          displayName: data.user?.displayName || currentUsername,
          bio: data.user?.bio || '',
          binderIsPrivate: data.user?.binderIsPrivate || false
        }));
      } catch (err) {
        showMessage('Failed to load user settings.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [currentUsername, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const updates = {
        username: currentUsername, // Must pass to identify user
        newUsername: formData.username !== currentUsername ? formData.username : undefined,
        displayName: formData.displayName,
        bio: formData.bio
      };

      const result = await updateProfile(updates);
      
      // If username changed successfully, update sessionStorage
      if (result.user?.username) {
        sessionStorage.setItem('username', result.user.username);
      }
      
      sessionStorage.setItem('displayName', formData.displayName || '');
      sessionStorage.setItem('bio', formData.bio || '');
      
      showMessage('Profile updated successfully!');
    } catch (err) {
      showMessage(err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      return showMessage('New passwords do not match.', 'error');
    }
    if (formData.newPassword.length > 0 && formData.newPassword.length < 6) {
      return showMessage('Password must be at least 6 characters.', 'error');
    }

    setIsSaving(true);
    try {
      await updateProfile({
        username: sessionStorage.getItem('username'),
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });
      
      // Clear password fields on success
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      showMessage('Password updated successfully!');
    } catch (err) {
      showMessage(err.message || 'Failed to update password.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePrivacy = async (e) => {
    const newPrivacyState = e.target.checked;
    setFormData(prev => ({ ...prev, binderIsPrivate: newPrivacyState }));
    
    try {
      await updateProfile({
        username: currentUsername,
        displayName: formData.displayName,
        bio: formData.bio,
        binderIsPrivate: newPrivacyState
      });
      showMessage(`Binder is now ${newPrivacyState ? 'private' : 'public'}.`);
    } catch (err) {
      // Revert if failed
      setFormData(prev => ({ ...prev, binderIsPrivate: !newPrivacyState }));
      showMessage(`Error: ${err.message || 'Failed to update privacy settings'}`, 'error');
    }
  };

  return (
    <div className="dashboard-container">
      <DynamicBackground />

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
              <img src={sessionStorage.getItem('avatarUrl') || '/pp.png'} alt="Profile Icon" className="profile-icon" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} /> Profile
            </button>
          </div>
        </div>
      </nav>

      <main className="settings-content">
        <div className="dashboard-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <button className="btn-cancel" style={{ padding: '0.4rem 0.8rem', marginBottom: '1rem', border: 'none', color: '#3b82f6' }} onClick={() => navigate('/profile')}>
              ← Back to Profile
            </button>
            <h1 className="dashboard-title">Settings</h1>
            <p className="dashboard-subtitle">Manage your account preferences and personal information.</p>
          </div>
        </div>

        {isLoading ? (
          <p style={{ color: '#9ca3af' }}>Loading settings...</p>
        ) : (
          <div className="settings-layout">
            <aside className="settings-sidebar">
              <button className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile Details</button>
              <button className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>Account & Security</button>
              <button className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>Privacy</button>
            </aside>

            <div className="settings-panel">
              {message.text && (
                <div className={`dialog-msg ${message.type === 'success' ? 'success' : 'error'}`} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}` }}>
                  {message.text}
                </div>
              )}

              {activeTab === 'profile' && (
                <form onSubmit={handleSaveProfile}>
                  <h2 className="settings-section-title">Profile Details</h2>
                  <div className="settings-form-group">
                    <label>Display Name</label>
                    <input type="text" className="dialog-input" name="displayName" value={formData.displayName} onChange={handleChange} placeholder="e.g. Ash Ketchum" />
                  </div>
                  <div className="settings-form-group">
                    <label>Username</label>
                    <input type="text" className="dialog-input" name="username" value={formData.username} onChange={handleChange} required />
                    <p className="settings-helper-text">Changing your username must be unique.</p>
                  </div>
                  <div className="settings-form-group">
                    <label>Bio</label>
                    <textarea className="dialog-input" name="bio" value={formData.bio} onChange={handleChange} rows="3" placeholder="Tell us about your collection..."></textarea>
                  </div>
                  <button type="submit" className="btn-submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Profile'}</button>
                </form>
              )}

              {activeTab === 'account' && (
                <form onSubmit={handleSaveAccount}>
                  <h2 className="settings-section-title">Change Password</h2>
                  <div className="settings-form-group">
                    <label>Current Password</label>
                    <input type="password" className="dialog-input" name="currentPassword" value={formData.currentPassword} onChange={handleChange} required />
                  </div>
                  <div className="settings-form-group">
                    <label>New Password</label>
                    <input type="password" className="dialog-input" name="newPassword" value={formData.newPassword} onChange={handleChange} required />
                  </div>
                  <div className="settings-form-group">
                    <label>Confirm New Password</label>
                    <input type="password" className="dialog-input" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
                  </div>
                  <button type="submit" className="btn-submit" disabled={isSaving}>{isSaving ? 'Updating...' : 'Update Password'}</button>
                </form>
              )}

              {activeTab === 'privacy' && (
                <div>
                  <h2 className="settings-section-title">Privacy Preferences</h2>
                  <div className="settings-form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div>
                      <label style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.25rem', display: 'block' }}>Private Binder</label>
                      <p className="settings-helper-text" style={{ marginTop: 0 }}>If enabled, other users will not be able to view your card collection.</p>
                    </div>
                    <input type="checkbox" name="binderIsPrivate" checked={formData.binderIsPrivate} onChange={handleTogglePrivacy} style={{ width: '24px', height: '24px', cursor: 'pointer' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Settings;
