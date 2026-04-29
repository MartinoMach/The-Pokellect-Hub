const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { CosmosClient } = require("@azure/cosmos");

const loadLocalSettings = () => {
  const localSettingsPath = join(process.cwd(), "local.settings.json");
  if (!existsSync(localSettingsPath)) return;

  const settings = JSON.parse(readFileSync(localSettingsPath, "utf8"));
  const values = settings?.Values || {};
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const getCosmosClient = () => {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;

  if (connectionString) return new CosmosClient(connectionString);
  if (endpoint && key) return new CosmosClient({ endpoint, key });

  throw new Error(
    "Missing Cosmos config. Set COSMOS_CONNECTION_STRING or both COSMOS_ENDPOINT and COSMOS_KEY.",
  );
};

const ensureContainer = async (database, id, partitionKeyPath) => {
  const { container } = await database.containers.createIfNotExists({
    id,
    partitionKey: { paths: [partitionKeyPath] },
  });
  console.log(`Container ready: ${container.id} (partition key: ${partitionKeyPath})`);
};

const run = async () => {
  loadLocalSettings();

  const databaseName = process.env.COSMOS_DATABASE_NAME || "Inst347DB";
  const client = getCosmosClient();
  const { database } = await client.databases.createIfNotExists({ id: databaseName });
  console.log(`Database ready: ${database.id}`);

  await ensureContainer(database, "Users", "/id");
  await ensureContainer(database, "Binders", "/owner");
  await ensureContainer(database, "Cards", "/franchiseId");
  await ensureContainer(database, "Franchises", "/id");

  console.log("Populating Franchises table...");
  const franchisesContainer = database.container("Franchises");
  const initialFranchises = [
    { id: "one-piece", franchiseId: "one-piece", name: "One Piece" },
    { id: "pokemon", franchiseId: "pokemon", name: "Pokémon" },
    { id: "dragon-ball-fusion", franchiseId: "dragon-ball-fusion", name: "Dragon Ball Fusion" },
    { id: "digimon", franchiseId: "digimon", name: "Digimon" },
    { id: "magic", franchiseId: "magic", name: "Magic" },
    { id: "union-arena", franchiseId: "union-arena", name: "Union Arena" },
    { id: "gundam", franchiseId: "gundam", name: "Gundam" },
    { id: "riftbound", franchiseId: "riftbound", name: "Riftbound" },
    { id: "star-wars-unlimited", franchiseId: "star-wars-unlimited", name: "Star Wars Unlimited" }
  ];

  for (const franchise of initialFranchises) {
    try {
      await franchisesContainer.items.upsert(franchise);
      console.log(`Added/Verified franchise: ${franchise.name}`);
    } catch (err) {
      console.error(`Failed to insert franchise ${franchise.name}:`, err.message);
    }
  }
  console.log("Franchises populated successfully!");
};

run().catch((error) => {
  console.error("Cosmos initialization failed:", error.message);
  process.exit(1);
});
