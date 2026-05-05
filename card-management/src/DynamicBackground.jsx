import React from 'react';
import './DynamicBackground.css';

export default function DynamicBackground() {
  return (
    <div className="bg-container">
      <div className="bg-gradient"></div>
      <div className="bg-glow-blob-1"></div>
      <div className="bg-glow-blob-2"></div>
    </div>
  );
}
