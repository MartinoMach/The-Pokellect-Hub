import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DynamicBackground from "./DynamicBackground.jsx";
import "./AboutUs.css";

const team = [
  {
    name: "Martins Okorie",
    role: "Backend Engineer",
    img: "/martins.png",
    desc: "Architecting robust APIs and seamless integrations for real-time card data.",
  },
  {
    name: "Chris Xu",
    role: "DevOps",
    img: "/chris.png",
    desc: "Ensuring cloud scalability, smooth deployments, and reliable infrastructure.",
  },
  {
    name: "Harshitha Jeyakumar",
    role: "Full Stack Engineer",
    img: "/harshitha.png",
    desc: "Bridging the gap between sleek interfaces and powerful backend logic.",
  },
  {
    name: "Ethan Tran",
    role: "Database Architect",
    img: "/ethan.png",
    desc: "Designing secure, high-performance Cosmos DB schemas for your collections.",
  },
  {
    name: "Neel Patel",
    role: "Testing and Performance Engineer",
    img: "/neel.png",
    desc: "Guaranteeing a bug-free, lightning-fast experience for every user.",
  }
];

export default function AboutUs() {
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="about-container">
      {/* Dynamic Background Elements */}
      <DynamicBackground />

      <Link to="/" className="btn-back-nav">← Back to Home</Link>

      <div className="about-content">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="about-header"
        >
          <h1 className="about-title">The Team Behind Pokéllect</h1>
          <p className="about-subtitle">
            Building the ultimate digital binder for card collectors to track prices, manage collections, and connect.
          </p>
        </motion.div>

        {/* Team Grid */}
        <div className="team-grid">
          {team.map((member, i) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.2 }}
              onHoverStart={() => setHovered(i)}
              onHoverEnd={() => setHovered(null)}
              className="team-card-wrapper"
            >
              {/* Glow background */}
              <div className={`glow-bg ${hovered === i ? "active" : "inactive"}`} />

              {/* Card */}
              <div className="team-card">
                {/* Floating animation ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
                  className="floating-ring"
                />

                <img src={member.img} alt={member.name} className="team-img" />

                <h2 className="member-name">{member.name}</h2>
                <p className="member-role">{member.role}</p>

                {/* Hover reveal */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={hovered === i ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  className="hover-reveal"
                >
                  {member.desc}
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="about-footer"
        >
          Built for Collectors • Powered by Azure
        </motion.div>
      </div>
    </div>
  );
}
