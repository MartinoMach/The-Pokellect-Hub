// ============================================================
// INST347 - Cosmos DB Connection
// File: api/db.js
// ============================================================

const { CosmosClient } = require("@azure/cosmos");

// These environment variables should be set in local.settings.json and in Azure Function App configuration.
const connectionString = process.env.COSMOS_CONNECTION_STRING;
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseName = process.env.COSMOS_DATABASE_NAME || "Inst347DB";

if (!connectionString && (!endpoint || !key)) {
  throw new Error(
    "CosmosDB configuration missing. Set COSMOS_CONNECTION_STRING or both COSMOS_ENDPOINT and COSMOS_KEY.",
  );
}

const client = connectionString
  ? new CosmosClient(connectionString)
  : new CosmosClient({ endpoint, key });

// Connect to the specific Database
const database = client.database(databaseName);

// Export the containers so your API functions can use them
module.exports = {
    usersContainer: database.container("Users"),
    bindersContainer: database.container("Binders"),
    cardsContainer: database.container("Cards"),
    franchisesContainer: database.container("Franchises"),
    messagesContainer: database.container("Messages")
};
