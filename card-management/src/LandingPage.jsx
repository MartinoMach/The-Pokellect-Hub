import React from 'react';
import { Link } from 'react-router-dom';
import DynamicBackground from './DynamicBackground.jsx';
import './LandingPage.css'

// Update these paths to point to the actual pngs in your public folder
const cards = [
  '/pokemon.png',
  '/dragon-ball.png',
  '/one-piece.png',
  '/digimon.png',
  '/deviant.png',
  '/riftbound.png',
  '/star-wars-unlimited.png',
  '/union-arena.png'
];

const supportedFranchises = [
  { name: "Pokémon", img: "/pokemon.png" },
  { name: "Dragon Ball", img: "/dragon-ball.png" },
  { name: "One Piece", img: "/one-piece.png" },
  { name: "Digimon", img: "/digimon.png" },
  { name: "Star Wars", img: "/star-wars-unlimited.png" },
  { name: "Union Arena", img: "/union-arena.png" }
];

export default function LandingPage() {
  return (
    <div className="landing-animated-container">
      {/* Dynamic Background Elements */}
      <DynamicBackground />

      {/* 1. Foreground Layer: The Navigation Bar (Highest z-index) */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="nav-logo">
            <img src="/logo.png" alt="Pokéllect logo" id="nav-logo-img" />
            <span id="nav-title">Pokéllect</span>
          </div>

          <div className="nav-actions">
            <Link to="/about" className="btn-about">About Us</Link>
            <Link to="/login" className="btn-login">Log in</Link>
            <Link to="/signup" className="btn-signup">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* 2. Hero Viewport (Takes up the first 100vh) */}
      <div className="hero-wrapper">

        <div className="carousel-section">
          <div className="scene" style={{ '--n': cards.length }}>
            <div className="a3d">
              {cards.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`Card ${index + 1}`}
                  className="card"
                  style={{ '--i': index }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Features Section (Scroll down to see) */}
      <section className="features-section">
        <h2 className="section-title">Everything a collector needs</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Live Price Tracking</h3>
            <p>We pull real-time market data directly from TCGPlayer and eBay so you always know exactly what your vault is worth.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🗂️</div>
            <h3>Digital Binder</h3>
            <p>Organize your pulls into custom folders, track card condition, and show off your grails to the world with a secure digital catalog.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🤝</div>
            <h3>Collector Community</h3>
            <p>Connect with friends, see what other collectors are pulling, and showcase your best collections safely.</p>
          </div>
        </div>
      </section>

      {/* 4. Supported Cards Section */}
      <section className="supported-section">
        <h2 className="section-title">Franchises We Support</h2>
        <p className="supported-subtitle">From Pokémon and Magic to One Piece and Dragon Ball, track all your favorite TCGs in one unified vault.</p>

        <div className="franchise-grid">
          {supportedFranchises.map((franchise, index) => (
            <div key={index} className="franchise-card">
              <div className="franchise-img-wrapper">
                <img src={franchise.img} alt={franchise.name} className="franchise-img" />
              </div>
              <h3 className="franchise-name">{franchise.name}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Call To Action Footer */}
      <section className="cta-section">
        <h2 className="section-title">Start building your digital binder today.</h2>
        <Link to="/signup" className="btn-signup cta-btn">
          Create Free Account
        </Link>
      </section>
    </div>
  );
}
