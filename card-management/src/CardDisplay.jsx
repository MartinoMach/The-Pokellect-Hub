import React from 'react';

// Helper to bypass strict image hotlinking (403 Forbidden)
const getProxiedImageUrl = (url) => {
  if (!url) return '/logo.png';
  if (url.startsWith('/')) return url;
  if (url.includes('blob.core.windows.net')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
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

function CardDisplay({ card, onClick }) {
  return (
    <div className="collection-card" onClick={() => onClick && onClick(card)}>
      <img
        src={card.imageUrl || '/logo.png'}
        alt={card.name || card.cardName}
        className="collection-card-img"
        referrerPolicy="no-referrer"
        onError={(e) => { e.target.onerror = null; e.target.src = getProxiedImageUrl(card.imageUrl); }}
      />
      <div style={{ padding: '0.75rem 0.5rem', textAlign: 'left', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{card.name || card.cardName}</h4>
        <div style={{ fontSize: '0.85rem', color: '#b3b3b3', display: 'flex', flexDirection: 'column', gap: '3px', flexGrow: 1 }}>
          <span>{card.setName || card.setId || 'Unknown Set'}</span>
          {card.rarity && card.rarity !== 'Unknown Rarity' ? (
            <span>{card.rarity}</span>
          ) : (
            <span style={{ color: '#777', fontStyle: 'italic' }}>No Rarity</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.9rem', marginTop: '12px' }}>
          <span style={{ color: '#888' }}>{formatLabel(card.franchiseId)}</span>
          <span style={{ fontWeight: 'bold', color: '#fff' }}>${card.currentPrice != null ? Number(card.currentPrice).toFixed(2) : '0.00'}</span>
        </div>
      </div>
    </div>
  );
}

export default CardDisplay;
