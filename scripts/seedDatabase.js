const { existsSync, readFileSync } = require("fs");
const { join } = require("path");

const loadLocalSettings = () => {
  const localSettingsPath = join(process.cwd(), "local.settings.json");
  if (!existsSync(localSettingsPath)) return;
  const settings = JSON.parse(readFileSync(localSettingsPath, "utf8"));
  const values = settings?.Values || {};
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
};
loadLocalSettings();

const API_BASE_URL = "http://localhost:7071/api";

const USER_CREDENTIALS = {
  username: "testuser1",
  password: "Password123!",
  displayName: "Test Collector",
};

// A list of known card IDs across different supported franchises
const CARDS_TO_IMPORT = [
  { franchiseId: "pokemon", cardId: "base1-4" }, // Charizard (Base Set)
  { franchiseId: "one-piece", cardId: "OP01-001" }, // Roronoa Zoro (Romance Dawn)
  { franchiseId: "digimon", cardId: "BT1-001" }, // Yokomon (Release Special)
  { franchiseId: "dragon-ball-fusion", cardId: "FS01-01" }, // Son Goku (Dragon Ball)
  { franchiseId: "gundam", cardId: "AR01-001" }, // Gundam Aerial (Gundam)
];

async function seedDatabase() {
  console.log("🌱 Starting Database Seed...");
  let token = "";

  // 1. Register the User
  console.log(`\n👤 Registering user: ${USER_CREDENTIALS.username}...`);
  const registerRes = await fetch(`${API_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(USER_CREDENTIALS),
  });
  const registerData = await registerRes.json();
  
  if (registerRes.status === 201) {
    console.log("✅ User registered successfully!");
  } else if (registerRes.status === 409) {
    console.log("⚠️ User already exists. Proceeding to login...");
  } else {
    console.error("❌ Registration failed:", registerData);
    return;
  }

  // 2. Login to get the Token
  console.log(`\n🔑 Logging in...`);
  const loginRes = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER_CREDENTIALS.username, password: USER_CREDENTIALS.password }),
  });
  const loginData = await loginRes.json();

  if (loginRes.status === 200 && loginData.token) {
    token = loginData.token;
    console.log("✅ Logged in successfully! Token received.");
  } else {
    console.error("❌ Login failed:", loginData);
    return;
  }

  // 3. Import Cards
  console.log(`\n🎴 Importing ${CARDS_TO_IMPORT.length} cards...`);
  for (const card of CARDS_TO_IMPORT) {
    let targetCardId = card.cardId;

    // Dynamically fetch a guaranteed valid ID from the external API to prevent 500 errors
    if (process.env.APITCG_API_KEY) {
      console.log(`  🔎 Attempting to dynamically resolve a valid ID for ${card.franchiseId}...`);
      try {
        const baseUrl = process.env.APITCG_BASE_URL || "https://www.apitcg.com/api";
        const checkRes = await fetch(`${baseUrl}/${card.franchiseId}/cards?limit=1`, {
          headers: { "x-api-key": process.env.APITCG_API_KEY }
        });
        const checkData = await checkRes.json();
        if (checkRes.ok && checkData?.data?.[0]?.id) {
          targetCardId = checkData.data[0].id;
          console.log(`  ✅ Dynamic lookup successful! Using found ID: ${targetCardId}`);
        } else {
          console.log(`  ⚠️  Dynamic lookup failed (Status: ${checkRes.status}). Falling back to hardcoded ID: ${card.cardId}`);
        }
      } catch (e) {
        console.log(`  ⚠️  Dynamic lookup threw an error. Falling back to hardcoded ID: ${card.cardId}`);
      }
    }

    console.log(`Fetching ${card.franchiseId} card: ${targetCardId}...`);
    
    const importRes = await fetch(`${API_BASE_URL}/importTcgapiCard`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({
        cardId: targetCardId,
        franchiseId: card.franchiseId,
        username: USER_CREDENTIALS.username,
        addToBinder: true, // Automatically add to the user's binder
        uploadImageToBlob: false // Set to true if you have Azure Storage fully configured!
      }),
    });

    const importData = await importRes.json();
    if (importRes.status === 200 || importRes.status === 201) {
      console.log(`  ✅ Success: ${importData.card?.name || card.cardId} added to database & binder.`);
    } else {
      console.error(`  ❌ Failed to import ${card.cardId}:`, importData.error);
    }
  }

  console.log("\n🎉 Seeding complete! Check your database to see the new data.");
}

seedDatabase().catch(console.error);