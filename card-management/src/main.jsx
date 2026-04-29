import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import SignUp from './Sign-Up.jsx'
import LogIn from './Log-in.jsx'
import Home from './Home.jsx'
import LandingPage from './LandingPage.jsx'
import Profile from './Profile.jsx'
import Friend from './Friend.jsx'
import AboutUs from './AboutUs.jsx'
import Collection from './Collection.jsx'
import CardDatabase from './CardDatabase.jsx'
import { DataProvider } from './DataContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage/>} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<LogIn />} />
          <Route path="/home" element={<Home />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/friend" element={<Friend />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/database" element={<CardDatabase />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  </StrictMode>
)
