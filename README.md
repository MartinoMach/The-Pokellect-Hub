<div align="center">
  <img src="./card-management/public/logo.png" alt="Pokéllect Logo" width="100" />
  <h1>🎴 Pokéllect</h1>
  <p><strong>The ultimate digital vault for modern card collectors.</strong></p>
  <p>Track, organize, and showcase your collection with real-time market data.</p>
</div>

---

## ✨ Features

- **Global Card Database:** Browse and search a massive catalog of trading cards across franchises like Pokémon, Dragon Ball, One Piece, Magic, and more.
- **Digital Binder:** Organize your pulls, track card conditions, and showcase your grails safely in a personalized digital collection.
- **Dynamic Portfolio Valuation:** Automatically calculates and displays the live market value of your entire collection.
- **Real-Time Market Tracking:** Pulls live price data directly from external APIs to estimate your total vault value.
- **Social & Community:** Send mutual friend requests, browse other collectors' public binders, and chat via the real-time Direct Messaging interface.
- **Sleek Glassmorphic UI:** A highly polished, animated, dark-mode frontend built with React, Framer Motion, and pure CSS.

## 💻 Tech Stack

### Frontend
- **Framework:** React + Vite
- **Routing:** React Router DOM
- **Styling:** Custom CSS with Glassmorphism & Framer Motion animations
- **State Management & Caching:** TanStack Query (React Query)

### Backend & Cloud (Azure)
- **Serverless:** Node.js Azure Functions (Model v4, Node 22)
- **Database:** Azure Cosmos DB (NoSQL)
- **Storage:** Azure Blob Storage (Card images & User avatars)
- **Authentication:** JWT (JSON Web Tokens) & `bcryptjs`

---

## 🚀 Getting Started

### Monorepo Commands
Run these from the root directory to easily manage the full stack:
- `npm install` — Installs dependencies for both the frontend and backend.
- `npm run dev` — Starts **both** the backend and frontend simultaneously.

### Environment Variables
To run the backend, create a `local.settings.json` file in the `backend/` directory based on the `local.settings.example.json` template.

| Variable | Description |
|----------|-------------|
| `AzureWebJobsStorage` | Azure Functions runtime storage account connection string |
| `AZURE_STORAGE_CONNECTION_STRING` | General app storage connection string |
| `AZURE_BLOB_STORAGE_CONNECTION_STRING` | Blob-specific override *(Recommended)* |
| `COSMOS_CONNECTION_STRING` | Primary Cosmos DB connection string |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens |
| `APITCG_API_KEY` | Required for APITCG card imports |
| `PRICE_PROVIDER` | Set to `apitcg`, `ebay`, or `none` |

---

## 🏗️ Architecture Details

### Cosmos DB Containers
- **`Users`** *(Partition Key: `/id`)* — Stores auth and profile fields (`username`, hashed `password`, `displayName`, `bio`, `binderIsPrivate`, `avatarUrl`).
- **`Binders`** *(Partition Key: `/owner`)* — Stores user collection entries linking users to their global cards.
- **`Cards`** *(Partition Key: `/franchiseId`)* — The master catalog of all known cards and their pricing metadata.
- **`Franchises`** *(Partition Key: `/id`)* — Stores supported franchise configurations.

### Core Azure Functions
| Function | Description |
|----------|-------------|
| **Auth & Profile** | `register`, `login`, `getProfile`, `updateProfile` |
| **Catalog** | `addGlobalCard`, `getGlobalCards`, `getMetadata` |
| **Binder** | `addToBinder`, `getMyBinder`, `removeFromBinder` |
| **Integration** | `importTcgapiCard`, `searchTcgapi`, `updateHotPrices` |

### Blob Storage
- Automatically resizes and compresses user profile avatars locally via `<canvas>` before uploading as Base64.
- Card images are natively pulled from external API sources and gracefully cached/mirrored in the `card-images` Azure Blob container.
- SAS (Shared Access Signature) tokens are dynamically generated for private, secure image serving.

---

## 🛠️ Utility Scripts
Navigate to the `backend/` directory to run helpful developer commands:

```bash
# Auto-create Cosmos DB database and containers if missing
npm run init:cosmos

# Validate backend function syntax
npm run check:backend

# Validate module loading
npm run smoke:load
```

---

## 👥 The Team

Designed and developed for **INST347**.

| Name | Role |
|------|------|
| **Martins Okorie** | Full Stack Engineer |
> *"Built for Collectors • Powered by Azure"*
