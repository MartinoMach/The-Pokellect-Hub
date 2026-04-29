<h1 align="center">🌟 Pokéllect</h1>

<p align="center">
  <img src="./card-management/public/logo.png" alt="Pokéllect Logo" width="150"/>
</p>

> **The Ultimate Trading Card Game (TCG) Hub**

Pokéllect is a modern, full-stack application built for trading card game enthusiasts. It provides a centralized platform for secure collection storage, real-time market price tracking, and a social hub to connect with fellow collectors. 

Engineered with scalability in mind, Pokéllect leverages a **cloud-native, serverless architecture** powered by Microsoft Azure, seamlessly integrating external APIs to deliver a rich, lightning-fast user experience.

👤 **Creator:** Martins Okorie

---

## ✨ Key Features

* 🎴 **Digital Binders:** Organize and manage your card collection in a secure, digital environment.
* 📈 **Live Price Tracking:** Integrates with eBay and APITCG to provide up-to-the-minute market valuations.
* 🌐 **Multi-Franchise Support:** A unified catalog spanning Pokémon, One Piece, Magic: The Gathering, Star Wars Unlimited, and more.
* 🤝 **Collector Community:** Search, find, and connect with other users and view their public binders.
* ☁️ **Cloud-Powered Reliability:** Built on Azure Functions, Cosmos DB, and Blob Storage for high availability and performance.

---

## 🏗️ Architecture & Code Explanation

Pokéllect is structured as a **Monorepo**, housing both the frontend client and backend services. 

### 1. The Backend (Serverless Azure Functions)
The backend is entirely serverless, ensuring we only compute when needed. It exposes RESTful endpoints interacting directly with our NoSQL databases and external providers.
* **Core Endpoints:** `register`, `login`, `getProfile`, `getGlobalCards`, `importTcgapiCard`, `addToBinder`, etc.
* **Authentication:** Secured via `jsonwebtoken` (JWT). Setting `AUTH_MODE=required` enforces strict bearer-token validation on protected write operations.
* **Automated Jobs:** Includes a CRON timer trigger (`updateHotPrices`) that runs every 12 hours to refresh the market values of highly-interacted cards.

### 2. Database (Azure Cosmos DB)
Data is distributed across logically partitioned containers for maximum query efficiency:
* **`Users`** (Partition: `/id`): Manages authentication and user profiles (`username`, hashed `password`, `bio`, `binderIsPrivate`).
* **`Binders`** (Partition: `/owner`): Stores the individual cards owned by users.
* **`Cards`** (Partition: `/franchiseId`): The global, canonical catalog of all imported cards and their pricing metadata.
* **`Franchises`** (Partition: `/id`): Metadata for supported TCGs.

### 3. Storage & Assets (Azure Blob)
Card images are securely managed and served:
* Images imported via external APIs are downloaded and stored securely in a private Azure Blob container (`uploadCardImage`).
* The backend dynamically generates **Shared Access Signatures (SAS)** with configurable TTLs (e.g., `BLOB_READ_SAS_TTL_MINUTES`), returning secure, temporary `imageUrl`s to the frontend.

### 4. External Data Providers
The app acts as an aggregator from top-tier TCG platforms:
* **APITCG:** The primary engine for canonical card metadata (importing cards dynamically via `cardId` + `franchiseId`).
* **eBay Browse API:** Used for dynamic price aggregation via OAuth client credentials.
* *Configurability:* Toggle between providers easily via the `PRICE_PROVIDER` env variable (`apitcg`, `ebay`, or `none`).

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* Azure CLI / Azure Functions Core Tools (for local backend execution)
* Active Azure Subscription (Cosmos DB & Blob Storage)

### Environment Variables (`backend/local.settings.json`)

Configure the following secrets to link the backend to your cloud and third-party services:

**Azure Storage & Compute:**
* `AzureWebJobsStorage`: Functions runtime storage connection string.
* `AZURE_STORAGE_CONNECTION_STRING`: General app storage connection string.
* `AZURE_BLOB_STORAGE_CONNECTION_STRING`: *(Optional but recommended)* Blob-specific override.

**Database (Cosmos DB):**
* `COSMOS_CONNECTION_STRING` (Preferred) **OR** `COSMOS_ENDPOINT` & `COSMOS_KEY`.
* `COSMOS_DATABASE_NAME`: Defaults to `PokellectDB`.

**Authentication:**
* `JWT_SECRET`: Used to sign and verify tokens.
* `AUTH_MODE`: Set to `required` to enforce authorization.

**APITCG Integration:**
* `APITCG_API_KEY`: Required for fetching payload schemas and card imports.
* `APITCG_BASE_URL`: Defaults to `https://www.apitcg.com/api`.
* *(Optional)* `APITCG_SCHEMA_CACHE_TTL_MS`, `APITCG_SCHEMA_SAMPLE_LIMIT`.

**eBay Integration (Optional):**
* `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_ENV`, `EBAY_MARKETPLACE_ID`.
* `EBAY_USE_MOCK_PRICES=true` *(for local development without real API calls).*

---

## 🛠️ CLI Commands & Utilities

This project uses NPM workspaces to manage the monorepo seamlessly. 

Run the following commands from the **root directory**:

### Start the App
```bash
# 1. Install dependencies for both frontend and backend
npm install

# 2. Start the React frontend and Azure backend concurrently
npm run dev
```

### Database Utilities
```bash
# Bootstrap Cosmos DB: Creates required databases and containers automatically
npm run init:cosmos --workspace=backend
```

### Testing & Validation
```bash
# Run syntax checks across the backend
npm run check:backend --workspace=backend

# Validate serverless function module loading
npm run smoke:load --workspace=backend
```

---

*Built to catch 'em all—and track their market value.*
