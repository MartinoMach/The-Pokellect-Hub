import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DynamicBackground from './DynamicBackground.jsx';
import { addToBinder, importTcgapiCard, getMetadata, searchTcgapi, getGlobalCards } from './api.js';
import './Collection.css'; // Inherit grid, cards, and modal styles!
import './CardDatabase.css'; // Specific styles for our new filters
import CardDisplay from './CardDisplay.jsx';
import Footer from './Footer.jsx';

// Helper to bypass strict image hotlinking (403 Forbidden)
const getProxiedImageUrl = (url) => {
  if (!url) return '/logo.png';
  if (url.startsWith('/')) return url;
  if (url.includes('blob.core.windows.net')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
};

function CardDatabase() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const username = sessionStorage.getItem('username');

  const { data: globalCards = [], isLoading } = useQuery({
    queryKey: ['globalCards'],
    queryFn: async () => {
      const res = await getGlobalCards();
      return Array.isArray(res) ? res : res.cards || [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFranchise, setSelectedFranchise] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  const [selectedStatsCard, setSelectedStatsCard] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');
  const statsDialogRef = useRef(null);

  // State for the new "Add Card" modal
  const addCardDialogRef = useRef(null);
  const [isAddingToDB, setIsAddingToDB] = useState(false);
  const [addCardMessage, setAddCardMessage] = useState('');
  const [addCardFranchise, setAddCardFranchise] = useState('');
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [apiSearchResults, setApiSearchResults] = useState([]);
  const [isApiSearching, setIsApiSearching] = useState(false);
  const [selectedApiCard, setSelectedApiCard] = useState(null);


  const [supportedFranchises, setSupportedFranchises] = useState([]);

  // Fetch franchises dynamically from your database
  useEffect(() => {
    const fetchFranchises = async () => {
      try {
        const data = await getMetadata();
        // Safely extract the franchise string whether the backend returns an array of objects or strings
        const rawFranchises = data.franchises || (Array.isArray(data) ? data : []);
        const dbFranchises = rawFranchises.map(f => f.franchiseId || f.id || f);
        setSupportedFranchises(dbFranchises);
      } catch (err) {
        console.error("Failed to load franchises from database:", err);
      }
    };
    fetchFranchises();
  }, []);

  // Extract unique options from globalCards for our filter dropdowns, injecting supported ones from DB
  const uniqueFranchises = ['All', ...new Set([...supportedFranchises, ...globalCards.map(c => c.franchiseId).filter(Boolean)])].sort();
  const uniqueTypes = ['All', ...new Set(globalCards.flatMap(c => Array.isArray(c.types) ? c.types : (c.types ? [c.types] : [])))].sort();

  // Debounced search effect for the external API
  useEffect(() => {
    if (apiSearchQuery.length < 3 || !addCardFranchise) {
      setApiSearchResults([]);
      return;
    }

    setIsApiSearching(true);
    const handler = setTimeout(async () => {
      try {
        const results = await searchTcgapi(addCardFranchise, apiSearchQuery);
        setApiSearchResults(results.cards || []);
      } catch (err) {
        setAddCardMessage(err.message || 'Failed to search for cards.');
        setApiSearchResults([]);
      } finally {
        setIsApiSearching(false);
      }
    }, 1000); // 1000ms debounce (wait 1 second after typing stops)

    return () => clearTimeout(handler);
  }, [apiSearchQuery, addCardFranchise]);

  const filteredCards = globalCards.filter(c => {
    const rawName = (c.name || c.cardName || '').toLowerCase();
    const query = searchQuery.toLowerCase();

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
    const matchesFranchise = selectedFranchise === 'All' || c.franchiseId === selectedFranchise;

    // 3. Card Type Filter Logic
    const cTypes = Array.isArray(c.types) ? c.types : (c.types ? [c.types] : []);
    const matchesType = selectedType === 'All' || cTypes.includes(selectedType);

    return matchesSearch && matchesFranchise && matchesType;
  });

  // Manage native dialog behavior for the modal
  useEffect(() => {
    if (selectedStatsCard && statsDialogRef.current && !statsDialogRef.current.open) {
      statsDialogRef.current.showModal();
    } else if (!selectedStatsCard && statsDialogRef.current && statsDialogRef.current.open) {
      statsDialogRef.current.close();
      setMessage('');
    }
  }, [selectedStatsCard]);

  const handleOpenAddCardModal = () => {
    // Reset all state for the modal
    setAddCardMessage('');
    setApiSearchQuery('');
    setApiSearchResults([]);
    setSelectedApiCard(null);

    setAddCardFranchise(''); // Force user to select a franchise explicitly
    addCardDialogRef.current.showModal();
  };

  const handleAddCard = async () => {
    if (!selectedStatsCard) return;
    setIsAdding(true);
    setMessage('');

    try {
      const username = sessionStorage.getItem('username');
      if (!username) throw new Error("You must be logged in to add cards.");

      await addToBinder(username, selectedStatsCard.id || selectedStatsCard.globalCardId, selectedStatsCard.franchiseId);
      setMessage('Card added successfully!');

      queryClient.invalidateQueries({ queryKey: ['binder', username] });

      // Close modal after success
      setTimeout(() => {
        setSelectedStatsCard(null);
      }, 1500);
    } catch (err) {
      setMessage(err.message || 'Failed to add card.');
    } finally {
      setIsAdding(false);
    }
  };

  // This function now handles adding from manual ID entry or search selection
  const handleImportCardToDB = async () => {
    const cardToImportId = selectedApiCard?.id || apiSearchQuery;
    if (!cardToImportId || !addCardFranchise) {
      setAddCardMessage('Please enter an ID or select a card.');
      return;
    }
    setIsAddingToDB(true);
    setAddCardMessage('Registering...');

    try {
      const response = await importTcgapiCard(addCardFranchise, cardToImportId);

      if (response.wasExisting) {
        setAddCardMessage('This card has already been registered.');
      } else {
        setAddCardMessage("Congrats! You're the first to register this card.");
      }

      queryClient.invalidateQueries({ queryKey: ['globalCards'] });

      setTimeout(() => { addCardDialogRef.current.close(); }, 2500);
    } catch (err) {
      setAddCardMessage(err.message || 'Failed to register card. It may not exist in the external TCG API.');
    } finally {
      setIsAddingToDB(false);
    }
  };

  // Formats franchise IDs into properly capitalized names
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
            <button className="nav-link-btn" onClick={() => navigate('/collection')}>Collection</button>
            <button className="nav-link-btn active">Card Database</button>
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
      <main className="dashboard-content">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Global Database</h1>
            <p className="dashboard-subtitle">Browse all available cards across different franchises.</p>
          </div>
        </div>

        {/* Advanced Filters Section */}
        <div className="filters-container">
          <div className="filter-group">
            <label>Search by Name</label>
            <input
              type="text"
              placeholder="e.g. Charizard..."
              className="filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Franchise</label>
            <select className="filter-select" value={selectedFranchise} onChange={(e) => setSelectedFranchise(e.target.value)}>
              {uniqueFranchises.map(f => <option key={f} value={f}>{formatLabel(f)}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Card Type</label>
            <select className="filter-select" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-action-group">
            <button className="btn-submit" onClick={handleOpenAddCardModal}>
              + Add New Card
            </button>
          </div>
        </div>

        {/* Database Cards Grid */}
        <div className="cards-grid">
          {isLoading ? (
            <div className="skeleton-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <div key={n} className="skeleton-card"></div>)}
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <h3>No cards found</h3>
              <p>Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredCards.map((card, idx) => (
              <CardDisplay 
                key={card.id || idx} 
                card={card} 
                onClick={setSelectedStatsCard} 
              />
            ))
          )}
        </div>
      </main>

      {/* Database Stats & Add Modal */}
      <dialog ref={statsDialogRef} className="glass-dialog" onClose={() => setSelectedStatsCard(null)}>
        {selectedStatsCard && (
          <div className="dialog-content stats-content">
            <h3 className="dialog-title">{selectedStatsCard.name}</h3>
            <img src={selectedStatsCard.imageUrl || '/logo.png'} alt={selectedStatsCard.name} className="stats-image" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(selectedStatsCard.imageUrl); }} />

            {message && <p className={`dialog-msg ${message.includes('success') ? 'success' : 'error'}`} style={{ marginTop: '1rem' }}>{message}</p>}
            <div className="dialog-actions" style={{ justifyContent: 'space-between', width: '100%', marginTop: '1rem' }}>
              <button className="btn-submit dialog-btn" onClick={handleAddCard} disabled={isAdding} style={{ margin: 0 }}>
                {isAdding ? 'Adding...' : '+ Add to Binder'}
              </button>
              <button className="btn-cancel" onClick={() => setSelectedStatsCard(null)}>Close</button>
            </div>
          </div>
        )}
      </dialog>

      {/* Add New Card to Database Modal */}
      <dialog ref={addCardDialogRef} className="glass-dialog" onClose={() => setAddCardMessage('')}>
        <div className="dialog-content">
          <h2 className="dialog-title">Add New Card to Database</h2>
          <p className="dialog-subtitle">Search the TCG API to import a new card.</p>

          <div className="register-form">
            <div className="filter-group">
              <label>Franchise</label>
              <select className="filter-select" value={addCardFranchise} onChange={(e) => { setAddCardFranchise(e.target.value); setApiSearchResults([]); setSelectedApiCard(null); }}>
              <option value="" disabled>Select franchise</option>
                {uniqueFranchises.filter(f => f !== 'All').map(f => <option key={f} value={f}>{formatLabel(f)}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Search by Card ID</label>
              <input type="text" placeholder="e.g. base1-4" className="dialog-input" value={apiSearchQuery} onChange={(e) => { setApiSearchQuery(e.target.value); setSelectedApiCard(null); }} />
            </div>
          </div>

          <div className="search-results api-search-results">
            {isApiSearching && <p className="no-results">Searching...</p>}
            {!isApiSearching && apiSearchResults.length === 0 && apiSearchQuery.length >= 3 && <p className="no-results">No cards found in the TCG API.</p>}
            {apiSearchResults.map((card) => (
              <div key={card.id} className={`search-result-item ${selectedApiCard?.id === card.id ? 'selected' : ''}`} onClick={() => setSelectedApiCard(card)}>
                <img src={card.imageUrl || '/logo.png'} alt={card.name} className="result-img" referrerPolicy="no-referrer" onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(card.imageUrl); }} />
                <div className="result-details">
                  <span>{card.name}</span>
                  <small>{card.setName}</small>
                </div>
              </div>
            ))}
          </div>

          {addCardMessage && <p className={`dialog-msg ${addCardMessage.includes('Congrats') ? 'success' : ''} ${addCardMessage.includes('Failed') ? 'error' : ''}`}>{addCardMessage}</p>}

          <div className="dialog-actions">
            <button className="btn-cancel" onClick={() => addCardDialogRef.current.close()}>Cancel</button>
            <button
              className="btn-submit dialog-btn"
              onClick={handleImportCardToDB}
              disabled={isAddingToDB || (!selectedApiCard && !apiSearchQuery)}
            >
              {isAddingToDB ? 'Registering...' : 'Register Card'}
            </button>
          </div>
        </div>
      </dialog>

      <Footer />
    </div>
  );
}

export default CardDatabase;
