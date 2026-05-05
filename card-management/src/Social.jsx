import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import DynamicBackground from './DynamicBackground.jsx';
import Footer from './Footer.jsx';
import { clearMessages, getMessages, getProfile, sendMessage } from './api.js';
import './Collection.css'; // For base layout & input styles
import './Social.css';

const normalizeUsername = (username) => (username || '').toLowerCase().trim();

export default function Social() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFriend, setActiveFriend] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);
  const clearChatDialogRef = useRef(null);
  const currentUsername = normalizeUsername(sessionStorage.getItem('username'));
  const messagesQueryKey = ['messages', currentUsername, activeFriend];

  const { data: profileData, isLoading: isLoadingProfile, isError: isProfileError } = useQuery({
    queryKey: ['profile', currentUsername],
    queryFn: () => getProfile(currentUsername),
    enabled: !!currentUsername,
    retry: false,
  });

  const friends = useMemo(() => {
    const rawFriends = profileData?.user?.friends || [];
    return rawFriends.map(normalizeUsername).filter(Boolean);
  }, [profileData]);

  const friendProfileQueries = useQueries({
    queries: friends.map((friend) => ({
      queryKey: ['profile', friend],
      queryFn: () => getProfile(friend),
      enabled: !!friend,
      retry: false,
    })),
  });

  const friendProfiles = useMemo(() => {
    return friends.reduce((profiles, friend, index) => {
      const user = friendProfileQueries[index]?.data?.user;
      profiles[friend] = {
        username: friend,
        displayName: user?.displayName || friend,
        avatarUrl: user?.avatarUrl || '/pp.png',
      };
      return profiles;
    }, {});
  }, [friends, friendProfileQueries]);

  const activeFriendProfile = activeFriend ? friendProfiles[activeFriend] : null;

  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    isError: isMessagesError,
  } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => getMessages(currentUsername, activeFriend),
    enabled: !!currentUsername && !!activeFriend,
    refetchInterval: activeFriend ? 3000 : false,
    staleTime: 1000,
    retry: false,
  });

  const currentMessages = messagesData?.messages || [];

  const sendMessageMutation = useMutation({
    mutationFn: ({ text }) => sendMessage(currentUsername, activeFriend, text),
    onMutate: async ({ text }) => {
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      const previousMessagesData = queryClient.getQueryData(messagesQueryKey);
      const optimisticMessage = {
        id: `pending_${Date.now()}`,
        sender: currentUsername,
        recipient: activeFriend,
        text,
        timestamp: new Date().toISOString(),
        isPending: true,
      };

      queryClient.setQueryData(messagesQueryKey, (oldData) => ({
        success: true,
        messages: [...(oldData?.messages || []), optimisticMessage],
      }));

      return { previousMessagesData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMessagesData) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessagesData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const clearMessagesMutation = useMutation({
    mutationFn: () => clearMessages(currentUsername, activeFriend),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previousMessagesData = queryClient.getQueryData(messagesQueryKey);
      queryClient.setQueryData(messagesQueryKey, { success: true, messages: [] });
      return { previousMessagesData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMessagesData) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessagesData);
      }
      alert(`Failed to send message: ${_error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  useEffect(() => {
    if (!currentUsername) {
      navigate('/login');
    }
  }, [currentUsername, navigate]);

  useEffect(() => {
    if (friends.length === 0) {
      setActiveFriend(null);
      return;
    }

    setActiveFriend((previousFriend) => {
      if (previousFriend && friends.includes(previousFriend)) return previousFriend;
      return friends[0];
    });
  }, [friends]);

  // Auto-scroll to the bottom of the chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeFriend]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeFriend) return;

    sendMessageMutation.mutate({ text: messageInput.trim() });
    setMessageInput('');
  };

  const handleClearChat = () => {
    if (!activeFriend) return;
    clearChatDialogRef.current.showModal();
  };

  const confirmClearChat = () => {
    if (!activeFriend) return;
    clearMessagesMutation.mutate();
    clearChatDialogRef.current.close();
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="dashboard-container">
      <DynamicBackground />

      {/* Navbar */}
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
            <button className="nav-link-btn active" onClick={() => navigate('/social')}>Social</button>
          </div>
          <div className="nav-actions">
            <button className="btn-profile" onClick={() => navigate('/profile')}>
              <img src={sessionStorage.getItem('avatarUrl') || '/pp.png'} alt="Profile Icon" className="profile-icon" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} /> Profile
            </button>
          </div>
        </div>
      </nav>

      <main className="social-content">
        <div className="dashboard-header" style={{ paddingBottom: '1rem' }}>
          <div>
            <h1 className="dashboard-title">Social</h1>
            <p className="dashboard-subtitle">Connect and chat with other collectors.</p>
          </div>
        </div>

        <div className="social-layout-container">
          {/* Sidebar */}
          <aside className="social-sidebar">
            <div className="social-sidebar-header">
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Direct Messages</h3>
            </div>
            <div className="social-friends-list">
              {isLoadingProfile ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none', background: 'transparent' }}>
                  <h3 style={{ fontSize: '1rem' }}>Loading friends...</h3>
                </div>
              ) : isProfileError ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none', background: 'transparent' }}>
                  <h3 style={{ fontSize: '1rem' }}>Could not load friends</h3>
                  <p style={{ fontSize: '0.85rem' }}>Try refreshing the page.</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none', background: 'transparent' }}>
                  <span className="empty-icon" style={{ fontSize: '2rem' }}>📭</span>
                  <h3 style={{ fontSize: '1rem' }}>No friends yet</h3>
                  <p style={{ fontSize: '0.85rem' }}>Visit your profile to find collectors!</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <div key={friend} className={`social-friend-item ${activeFriend === friend ? 'active' : ''}`} onClick={() => setActiveFriend(friend)}>
                    <img
                      src={friendProfiles[friend]?.avatarUrl || '/pp.png'}
                      alt={friend}
                      className="social-friend-avatar"
                      onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }}
                    />
                    <span style={{ fontWeight: '600', color: '#fff' }}>{friendProfiles[friend]?.displayName || friend}</span>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Chat Window */}
          <section className="social-chat-window">
            {activeFriend ? (
              <>
                <div className="chat-header">
                  <img
                    src={activeFriendProfile?.avatarUrl || '/pp.png'}
                    alt={activeFriend}
                    className="social-friend-avatar"
                    style={{ width: '40px', height: '40px' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }}
                  />
                  <h3 style={{ margin: 0, color: '#fff' }}>{activeFriendProfile?.displayName || activeFriend}</h3>
                  <button className="btn-cancel" style={{ marginLeft: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={handleClearChat}>
                    Clear Chat
                  </button>
                </div>
                <div className="chat-messages-area">
                  {isLoadingMessages && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 'auto', marginBottom: 'auto' }}>Loading messages...</p>}
                  {isMessagesError && <p style={{ textAlign: 'center', color: '#fca5a5', marginTop: 'auto', marginBottom: 'auto' }}>Could not load messages. Try refreshing the page.</p>}
                  {!isLoadingMessages && !isMessagesError && currentMessages.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 'auto', marginBottom: 'auto' }}>This is the beginning of your chat history with {activeFriend}.</p>}
                  {currentMessages.map(msg => {
                    const isSent = msg.sender === currentUsername;
                    const avatarSrc = isSent ? (sessionStorage.getItem('avatarUrl') || '/pp.png') : (friendProfiles[msg.sender]?.avatarUrl || '/pp.png');
                    return (
                      <div key={msg.id} className={`chat-message-wrapper ${isSent ? 'received' : 'sent'}`}>
                        {isSent && <img src={avatarSrc} alt={msg.sender} className="chat-message-avatar" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />}
                        <div className="chat-message-content">
                        <div className={`chat-bubble ${isSent ? 'sent' : 'received'}`}>{msg.text}</div>
                          <span className="chat-timestamp">{formatTime(msg.timestamp)}</span>
                        </div>
                        {!isSent && <img src={avatarSrc} alt={msg.sender} className="chat-message-avatar" onError={(e) => { e.target.onerror = null; e.target.src = '/pp.png'; }} />}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <form className="chat-input-area" onSubmit={handleSendMessage}>
                  <div className="chat-input-wrapper">
                    <input type="text" className="dialog-input chat-input" style={{ margin: 0 }} placeholder={`Message @${activeFriend}...`} value={messageInput} onChange={(e) => setMessageInput(e.target.value)} />
                    <button type="submit" className="btn-submit chat-send-btn" style={{ margin: 0, width: 'auto' }} disabled={!messageInput.trim() || sendMessageMutation.isPending}>Send</button>
                  </div>
                </form>
              </>
            ) : (<div className="empty-state" style={{ height: '100%', border: 'none', background: 'transparent' }}><span className="empty-icon">💬</span><h3>Select a friend</h3><p>Choose a friend from the sidebar to start chatting.</p></div>)}
          </section>
        </div>
      </main>

      {/* Clear Chat Confirmation Modal */}
      <dialog ref={clearChatDialogRef} className="glass-dialog">
        <div className="dialog-content">
          <h2 className="dialog-title">Clear Chat</h2>
          <p className="dialog-subtitle" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
            Are you sure you want to clear your chat history with <strong>{activeFriend}</strong>?
          </p>

          <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
            <button className="btn-cancel" onClick={() => clearChatDialogRef.current.close()}>Cancel</button>
            <button className="btn-remove dialog-btn" style={{ margin: 0 }} onClick={confirmClearChat}>Clear Chat</button>
          </div>
        </div>
      </dialog>

      <Footer />
    </div>
  );
}
