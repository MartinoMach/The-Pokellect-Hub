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
import Social from './Social.jsx'
import Settings from './Settings.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Cache data in memory for 5 minutes
      refetchOnWindowFocus: false, // Prevent unnecessary fetches when changing tabs
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
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
          <Route path="/social" element={<Social />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)
