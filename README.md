# inst347-project
Respository for INST347 Project

Project entails develop card collection storage, price tracking, and social platform to connect with other card collecting enthusiasts. Tools in Azure are integrated and external APIs.

Collaborators --> Harshita Jeyakumar, Martins Okorie, Neel Patel, Ethan Tran, Chris Xu

## Backend (Azure Functions + Cosmos DB)

### Runtime
- Node.js Azure Functions programming model v4 (`@azure/functions`)
- Entry point: `index.js`
- Function source: `api/functions/*.js`
- Host config: `host.json`
- Local settings template: `local.settings.example.json`

### Required Environment Variables
- `AzureWebJobsStorage` (Azure Functions runtime storage account connection string)
- `AZURE_STORAGE_CONNECTION_STRING` (general app storage connection string)
- Optional but recommended: `AZURE_BLOB_STORAGE_CONNECTION_STRING` (blob-specific override)
- `APITCG_BASE_URL` (defaults to `https://www.apitcg.com/api`)
- `APITCG_API_KEY` (required for apitcg card imports)
- Optional: `APITCG_SCHEMA_CACHE_TTL_MS` (default `600000`, 10 minutes)
- Optional: `APITCG_SCHEMA_SAMPLE_LIMIT` (default `3`, max `25`)
- `COSMOS_CONNECTION_STRING` (preferred)
- or both `COSMOS_ENDPOINT` and `COSMOS_KEY`
- Optional: `COSMOS_DATABASE_NAME` (defaults to `Inst347DB`)

### Cosmos DB Containers
- `Users`
  - Suggested partition key: `/id`
  - Stores auth/profile fields (`username`, hashed `password`, `displayName`, `bio`, `binderIsPrivate`)
- `Binders`
  - Suggested partition key: `/owner`
  - Stores user binder entries (`owner`, `globalCardId`, `franchiseId`, `cardName`, `blobName`, `sourceImageUrl`, `imageUrl`)
- `Cards`
  - Suggested partition key: `/franchiseId` (or `/partitionKey` if standardized to same value)
  - Stores global card catalog + price metadata (`blobName`, `sourceImageUrl`, `imageUrl`, `currentPrice`, `lastPriceUpdate`, `lastInteractedAt`, `interactionCount`)
- `Franchises`
  - Suggested partition key: `/id`
  - Stores franchise metadata

### Main API Functions
- `register`, `login`, `getProfile`, `updateProfile`
- `addFranchise`, `getMetadata`
- `addGlobalCard`, `getGlobalCards`
- `addToBinder`, `getMyBinder`, `removeFromBinder`
- `importTcgapiCard` (imports cards from apitcg.com into CosmosDB)
- `uploadCardImage` (uploads card images to Azure Blob Storage)
- `updateHotPrices` (timer trigger every 12 hours)

### Authentication
- Token auth is enabled through `jsonwebtoken`
- `register` and `login` now return a `token`
- Set `AUTH_MODE=required` to enforce auth on protected write endpoints
- Configure `JWT_SECRET` in both local settings and Azure Function App settings
- Binder/profile owner checks now use bearer token identity (not query-string identity)

### External API Integration
- APITCG:
  - `importTcgapiCard` imports card metadata by `cardId` + franchise id
  - Config: `APITCG_BASE_URL`, `APITCG_API_KEY`
  - Supported franchises (from `/api/<franchise>/cards`):
    - `one-piece`
    - `pokemon`
    - `dragon-ball-fusion`
    - `digimon`
    - `magic`
    - `union-arena`
    - `gundam`
    - `riftbound`
    - `star-wars-unlimited`
- eBay:
  - Price refresh uses eBay Browse API + OAuth client credentials
  - Config: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_ENV`, `EBAY_MARKETPLACE_ID`
  - `EBAY_USE_MOCK_PRICES=true` can be used for development fallback

### Price Provider Configuration
- `PRICE_PROVIDER=apitcg` (default) imports canonical card metadata from APITCG
- `PRICE_PROVIDER=ebay` enables the eBay-based pricing flow
- `PRICE_PROVIDER=none` disables external price refresh

### Metadata Output
- `getMetadata` now returns:
  - `franchises`: merged franchise catalog for UI dropdowns
  - `franchiseCardSchemas`: per-franchise APITCG card schema summaries (top-level fields, nested field paths, sample cards, status)
  - `franchiseCardSchemasGeneratedAt`: ISO timestamp when schema payload was generated
  - `franchiseCardSchemasSampleLimit`: how many cards per franchise were inspected
- Schema discovery is cached in-memory using `APITCG_SCHEMA_CACHE_TTL_MS`.

### Blob Storage Integration
- `uploadCardImage` downloads a remote image URL and stores it in Blob Storage
- `addGlobalCard` and `importTcgapiCard` upload card images to blob by default (`uploadImageToBlob=true` unless explicitly set to `false`)
- Uploads are restricted to image content types (`image/jpeg`, `image/png`, `image/gif`, `image/webp`)
- Blob names are normalized under `cards/...` to keep the `card-images` container card-image-only
- The container remains private; API responses now return signed read URLs (SAS) for `imageUrl` fields so images can still render securely
- Canonical storage fields:
  - `blobName`: canonical pointer to your managed asset in Azure Blob (preferred for long-term serving)
  - `sourceImageUrl`: original upstream source URL (for traceability/re-import)
  - `imageUrl`: display URL returned by APIs (signed SAS when blob-backed)
- Optional: `BLOB_READ_SAS_TTL_MINUTES` controls signed URL lifetime (default `60`)
- Config resolution order:
  - `AZURE_BLOB_STORAGE_CONNECTION_STRING` (first choice)
  - `AZURE_STORAGE_CONNECTION_STRING`
  - `AzureWebJobsStorage` (fallback)
  - `BLOB_CONTAINER_NAME`

### Utility Scripts
- `npm run init:cosmos` creates DB/containers if they do not exist
- `npm run check:backend` runs backend syntax checks
- `npm run smoke:load` validates function module loading
