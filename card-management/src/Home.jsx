import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DynamicBackground from './DynamicBackground.jsx';
import './Home.css'
import './LandingPage.css' // Import LandingPage styles to inherit the perfect layout
import Footer from './Footer.jsx';

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

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="landing-animated-container">
      {/* Dynamic Background Elements */}
      <DynamicBackground />

      {/* 1. Foreground Layer: The Navigation Bar (Highest z-index) */}
      <nav className="navbar">
        <div className="navbar-container">
          <div className="nav-logo" onClick={() => navigate('/home')} style={{cursor: 'pointer'}}>
            <img src="/logo.png" alt="Pokéllect logo" id="nav-logo-img" />
            <span id="nav-title">Pokéllect</span>
          </div>

          <div className="nav-links">
            <button className="nav-link-btn active">Home</button>
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

      {/* 2. Hero Text Section */}
      <div className="hero-section" style={{ marginTop: '140px', paddingBottom: '20px' }}>
        <motion.h1
          className="hero-title"
          style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '3rem', letterSpacing: 'normal' }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          Pokéllect
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          style={{ fontSize: '1.6rem', fontWeight: '500' }}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          "The ultimate digital vault for modern card collectors."
        </motion.p>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ marginTop: '1.5rem', height: '3px', width: '6rem', background: 'linear-gradient(to right, #8b5cf6, #3b82f6)', transformOrigin: 'center', borderRadius: '2px' }}
        />
      </div>

      {/* 3. 3D Carousel Viewport */}
      <div className="hero-wrapper" style={{ height: '70vh' }}>
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

      <Footer />
    </div>
  );
}
