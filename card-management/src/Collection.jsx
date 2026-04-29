import { useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from "react";
import DynamicBackground from './DynamicBackground.jsx'
import { addToBinder, getMetadata } from './api.js'
import { useData } from './DataContext.jsx'
import './Collection.css'
import './CardDatabase.css' // Reuse the styles for our filters

// Helper to bypass strict image hotlinking (403 Forbidden) from official TCG sites
const getProxiedImageUrl = (url) => {
  if (!url) return '/logo.png';
  if (url.startsWith('/')) return url; // Local assets
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
};

function Collection() {
  const navigate = useNavigate()
  const dialogRef = useRef(null)
  const statsDialogRef = useRef(null)
  const { globalCards, binderCards, isLoading, refreshBinder } = useData();

  // State for cards and UI interactions
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedStatsCard, setSelectedStatsCard] = useState(null);

  // State for filtering the collection
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [collectionSelectedFranchise, setCollectionSelectedFranchise] = useState('All');
  const [collectionSelectedType, setCollectionSelectedType] = useState('All');

  const [supportedFranchises, setSupportedFranchises] = useState([]);

  // Fetch franchises dynamically from your database
  useEffect(() => {
    const fetchFranchises = async () => {
      try {
        const data = await getMetadata();
        const rawFranchises = data.franchises || (Array.isArray(data) ? data : []);
        const dbFranchises = rawFranchises.map(f => f.franchiseId || f.id || f);
        setSupportedFranchises(dbFranchises);
      } catch (err) {
        console.error("Failed to load franchises from database:", err);
      }
    };
    fetchFranchises();
  }, []);

  // Manage native dialog behavior for the stats modal
  useEffect(() => {
    if (selectedStatsCard && statsDialogRef.current && !statsDialogRef.current.open) {
      statsDialogRef.current.showModal();
    } else if (!selectedStatsCard && statsDialogRef.current && statsDialogRef.current.open) {
      statsDialogRef.current.close();
    }
  }, [selectedStatsCard]);

  // Extract unique options dynamically from the user's binder
  const uniqueBinderFranchises = ['All', ...new Set([...supportedFranchises, ...binderCards.map(c => c.franchiseId).filter(Boolean)])].sort();
  const uniqueBinderTypes = ['All', ...new Set(binderCards.map(c => {
    const globalCard = globalCards.find(g => g.id === (c.globalCardId || c.id));
    return globalCard?.types;
  }).flatMap(t => Array.isArray(t) ? t : (t ? [t] : [])))].sort();

  // Filter logic for the binder cards
  const filteredBinderCards = binderCards.filter(c => {
    const rawName = (c.cardName || c.name || '').toLowerCase();
    const query = collectionSearchQuery.toLowerCase();

    // 1. Text Search Logic
    let matchesSearch = true;
    if (query) {
      if (!rawName.includes(query)) {
        const strippedName = rawName.replace(/[^a-z0-9]/g, '');
        const strippedQuery = query.replace(/[^a-z0-9]/g, '');
        matchesSearch = strippedQuery && strippedName.includes(strippedQuery);
      }
    }

    // 2. Franchise Filter Logic
    const matchesFranchise = collectionSelectedFranchise === 'All' || c.franchiseId === collectionSelectedFranchise;

    // 3. Card Type Filter Logic
    const globalCard = globalCards.find(g => g.id === (c.globalCardId || c.id));
    const cTypes = Array.isArray(globalCard?.types) ? globalCard.types : (globalCard?.types ? [globalCard.types] : []);
    const matchesType = collectionSelectedType === 'All' || cTypes.includes(collectionSelectedType);

    return matchesSearch && matchesFranchise && matchesType;
  });

  const formatLabel = (val) => {
    if (!val || val === 'All') return 'All';

    const customLabels = {
      'pokemon': 'Pokémon',
      'dragon-ball-fusion': 'Dragon Ball Fusion',
      'star-wars-unlimited': 'Star Wars Unlimited',
      'one-piece': 'One Piece',
      'digimon': 'Digimon',
      'magic': 'Magic',
      'union-arena': 'Union Arena',
      'gundam': 'Gundam',
      'riftbound': 'Riftbound'
    };
    if (customLabels[val.toLowerCase()]) return customLabels[val.toLowerCase()];

    return val.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const filteredCards = globalCards.filter(c => {
    const rawName = (c.name || c.cardName || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    // Standard check first
    if (rawName.includes(query)) return true;

    // Strip out all punctuation and spaces for a forgiving match
    const strippedName = rawName.replace(/[^a-z0-9]/g, '');
    const strippedQuery = query.replace(/[^a-z0-9]/g, '');

    if (strippedQuery && strippedName.includes(strippedQuery)) return true;
    return false;
  });

  const handleAddCard = async () => {
    if (!selectedCard) return;
    setIsAdding(true);
    setMessage('');
    try {
      const username = localStorage.getItem('username');
      await addToBinder(username, selectedCard.id || selectedCard.globalCardId, selectedCard.franchiseId);
      setMessage('Card added successfully!');

      // Refresh globally cached binder
      await refreshBinder();

      setTimeout(() => {
        dialogRef.current.close();
        setMessage('');
        setSelectedCard(null);
        setSearchQuery('');
      }, 1500);
    } catch (err) {
      setMessage(err.message || 'Failed to add card.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!selectedStatsCard) return;

    const username = localStorage.getItem('username');
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`/api/removeFromBinder?binderId=${selectedStatsCard.id}&username=${username}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove card');
      }

      await refreshBinder();
      setSelectedStatsCard(null); // This automatically closes the dialog via our useEffect
    } catch (err) {
      alert("Failed to remove card: " + err.message);
    }
  };

  return (
    <div className="dashboard-container">
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
            <button className="nav-link-btn active">Collection</button>
            <button className="nav-link-btn" onClick={() => navigate('/database')}>Card Database</button>
            <button className="nav-link-btn" onClick={() => navigate('/profile')}>Friends</button>
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
      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">My Collection</h1>
            <p className="dashboard-subtitle">Manage and track your trading cards.</p>
          </div>
          <button className="btn-submit add-card-btn" onClick={() => dialogRef.current.showModal()}>
            + Add Card
          </button>
        </div>

      {/* Collection Filters Section */}
      <div className="filters-container">
        <div className="filter-group">
          <label>Search Collection</label>
          <input
            type="text"
            placeholder="e.g. Charizard..."
            className="filter-input"
            value={collectionSearchQuery}
            onChange={(e) => setCollectionSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Franchise</label>
          <select className="filter-select" value={collectionSelectedFranchise} onChange={(e) => setCollectionSelectedFranchise(e.target.value)}>
            {uniqueBinderFranchises.map(f => <option key={f} value={f}>{formatLabel(f)}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Card Type</label>
          <select className="filter-select" value={collectionSelectedType} onChange={(e) => setCollectionSelectedType(e.target.value)}>
            {uniqueBinderTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

        <div className="cards-grid">
          {isLoading ? (
            <div className="skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map(n => <div key={n} className="skeleton-card"></div>)}
            </div>
          ) : binderCards.length === 0 ? (
           <div className="empty-state">
              <span className="empty-icon">🎴</span>
              <h3>No cards yet</h3>
              <p>Click "Add Card" to start building your digital binder.</p>
           </div>
        ) : filteredBinderCards.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <h3>No cards found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
          ) : (
          filteredBinderCards.map((card, idx) => (
              <div
                key={card.id || idx}
                className="collection-card"
                onClick={() => setSelectedStatsCard(card)}
              >
                <img
                  src={card.imageUrl || '/logo.png'}
                  alt={card.cardName}
                  className="collection-card-img"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(card.imageUrl); }}
                />
                <h4>{card.cardName}</h4>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Glassmorphism Modal Dialog */}
      <dialog ref={dialogRef} className="glass-dialog">
        <div className="dialog-content">
          <h2 className="dialog-title">Add New Card</h2>
          <p className="dialog-subtitle">Search the database to add a card to your collection.</p>

          <input
            type="text"
            placeholder="Search by card name..."
            className="dialog-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="search-results">
            {filteredCards.slice(0, 5).map((card, idx) => (
              <div
                key={card.id || idx}
                className={`search-result-item ${selectedCard?.id === card.id ? 'selected' : ''}`}
                onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
              >
                <img
                  src={card.imageUrl || '/logo.png'}
                  alt={card.name}
                  className="result-img"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(card.imageUrl); }}
                />
                <span>{card.name || card.cardName}</span>
              </div>
            ))}
            {filteredCards.length === 0 && <p className="no-results">No cards found.</p>}
          </div>

          {message && <p className={`dialog-msg ${message.includes('success') ? 'success' : 'error'}`}>{message}</p>}

          <div className="dialog-actions">
            <button className="btn-cancel" onClick={() => dialogRef.current.close()}>Cancel</button>
            <button
              className="btn-submit dialog-btn"
              onClick={handleAddCard}
              disabled={!selectedCard || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add to Binder'}
            </button>
          </div>
        </div>
      </dialog>

      {/* Card Stats Modal */}
      <dialog ref={statsDialogRef} className="glass-dialog" onClose={() => setSelectedStatsCard(null)}>
        {selectedStatsCard && (
          <div className="dialog-content stats-content">
            <h3 className="dialog-title">{selectedStatsCard.cardName}</h3>

            <img
              src={selectedStatsCard.imageUrl || '/logo.png'}
              alt={selectedStatsCard.cardName}
              className="stats-image"
              referrerPolicy="no-referrer"
              onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(selectedStatsCard.imageUrl); }}
            />

            <div className="stats-details">
              <p><strong>Franchise:</strong> {selectedStatsCard.franchiseId ? selectedStatsCard.franchiseId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}</p>

              {/* Cross-reference globalCards to display extended stats */}
              {(() => {
                const fullStats = globalCards.find(c => c.id === (selectedStatsCard.globalCardId || selectedStatsCard.id));
                return fullStats ? (
                  <>
                    {(fullStats.setName || fullStats.setId) && <p><strong>Set Name:</strong> {fullStats.setName || fullStats.setId}</p>}
                    {fullStats.rarity && <p><strong>Rarity:</strong> {fullStats.rarity}</p>}
                    {fullStats.types && fullStats.types.length > 0 && <p><strong>Type:</strong> {Array.isArray(fullStats.types) ? fullStats.types.join(', ') : fullStats.types}</p>}
                    {fullStats.hp && <p><strong>HP:</strong> {fullStats.hp}</p>}
                    {fullStats.power && <p><strong>Power:</strong> {fullStats.power}</p>}
                  </>
                ) : null;
              })()}
            </div>

            <div className="dialog-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <button className="btn-remove" onClick={handleRemoveCard}>
                Remove
              </button>
              <button className="btn-cancel" onClick={() => setSelectedStatsCard(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}

export default Collection;
