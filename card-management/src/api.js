// Use an environment variable for the API base URL in production, fallback to local proxy path
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Helper to handle API responses and errors
const handleResponse = async (response) => {
  let data = {};
  const text = await response.text(); // Read as raw text first

  if (text) {
    try {
      data = JSON.parse(text); // Try to parse it as JSON safely
    } catch (err) {
      data = { error: "Server returned an invalid response (not JSON)." };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `HTTP Error ${response.status}: Failed to connect to backend.`);
  }
  return data;
};

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// Log In function
export const login = async (username, password) => {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await handleResponse(response);

  // Store the JWT token and username for authenticated requests later
  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', username);
  }

  return data;
};

// Fetch all available cards from the global database
export const getGlobalCards = async () => {
  const response = await fetch(`${API_BASE_URL}/getGlobalCards`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// Fetch the logged-in user's binder
export const getMyBinder = async (username) => {
  const response = await fetch(`${API_BASE_URL}/getMyBinder?username=${encodeURIComponent(username)}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
};

// Add a card to the user's binder
export const addToBinder = async (username, globalCardId, franchiseId) => {
  const response = await fetch(`${API_BASE_URL}/addToBinder`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username, globalCardId, franchiseId }),
  });
  return handleResponse(response);
};

// Import a card from the TCG API into the global database
export const importTcgapiCard = async (franchiseId, cardId) => {
  const response = await fetch(`${API_BASE_URL}/importTcgapiCard`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      franchiseId,
      cardId,
      username: localStorage.getItem('username'), // For auth checks
    }),
  });
  return handleResponse(response);
};

// Search the external TCG API for cards to register
export const searchTcgapi = async (franchiseId, query) => {
  const response = await fetch(`${API_BASE_URL}/searchTcgapi?franchiseId=${encodeURIComponent(franchiseId)}&q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Sign Up function
export const register = async (username, password) => {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await handleResponse(response);

  if (data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', username);
  }

  return data;
};

// Search for users in the database
export const searchUsers = async (query) => {
  const response = await fetch(`${API_BASE_URL}/searchUsers?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Fetch a user's profile and public binder
export const getProfile = async (username) => {
  const response = await fetch(`${API_BASE_URL}/getProfile?user=${encodeURIComponent(username)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};

// Fetch metadata like the list of supported franchises from your database
export const getMetadata = async () => {
  const response = await fetch(`${API_BASE_URL}/getMetadata`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return handleResponse(response);
};
