import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css'; // Inherits the anti-flicker .footer-link styles

function Footer() {
  return (
    <footer style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.05)', marginTop: 'auto', position: 'relative', zIndex: 10, boxSizing: 'border-box', flexShrink: 0 }}>
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0.5rem 2rem', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', boxSizing: 'border-box' }}>
        
        {/* Left: Copyright */}
        <div style={{ flex: 1, color: '#6b7280', fontSize: '0.85rem', textAlign: 'left', minWidth: '200px' }}>
          Copyright &copy; 2026 Apple Inc. All rights reserved.
        </div>

        {/* Center: Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <Link to="/about" className="footer-link">About Us</Link>
          <a href="#contact" className="footer-link">Contact</a>
          <a href="#privacy" className="footer-link">Privacy Policy</a>
          <a href="#terms" className="footer-link">Terms of Service</a>
        </div>

        {/* Right: Logo */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: '200px' }}>
          <img src="/logo.png" alt="Pokéllect logo" style={{ height: '28px', width: '28px', opacity: 0.8, borderRadius: '4px' }} />
        </div>
        
      </div>
    </footer>
  );
}

export default Footer;