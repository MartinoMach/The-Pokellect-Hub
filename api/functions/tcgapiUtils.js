const axios = require("axios");

const createSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const SUPPORTED_TCGAPI_FRANCHISES = Object.freeze({
  "one-piece": "One Piece",
  pokemon: "Pokemon",
  "dragon-ball-fusion": "Dragon Ball Fusion",
  digimon: "Digimon",
  magic: "Magic",
  "union-arena": "Union Arena",
  gundam: "Gundam",
  riftbound: "Riftbound",
  "star-wars-unlimited": "Star Wars Unlimited",
});

const FRANCHISE_ALIASES = Object.freeze({
  onepiece: "one-piece",
  "dragon-ball": "dragon-ball-fusion",
  dragonballfusion: "dragon-ball-fusion",
  dragonball: "dragon-ball-fusion",
  "star-wards-unlimited": "star-wars-unlimited",
  starwarsunlimited: "star-wars-unlimited",
});

const TCGAPI_BASE_URL = (process.env.APITCG_BASE_URL || "https://www.apitcg.com/api").replace(/\/+$/, "");
const TCGAPI_SCHEMA_CACHE_TTL_MS = Math.max(
  60 * 1000,
  Number(process.env.APITCG_SCHEMA_CACHE_TTL_MS) || 10 * 60 * 1000,
);
const TCGAPI_SCHEMA_SAMPLE_LIMIT = Math.max(
  1,
  Math.min(25, Number(process.env.APITCG_SCHEMA_SAMPLE_LIMIT) || 3),
);

let cachedSchemaPayload = null;
let cachedSchemaAt = 0;
let schemaFetchInFlight = null;

const getTcgapiApiKey = () => process.env.APITCG_API_KEY || process.env.TCGAPI_API_KEY || "";

const getTcgapiHeaders = () => {
  const apiKey = getTcgapiApiKey();
  if (!apiKey) {
    throw new Error("Missing APITCG_API_KEY. Set APITCG_API_KEY in environment settings.");
  }

  return {
    "x-api-key": apiKey,
  };
};

const getTcgapiCardsPage = async (franchiseId, options = {}) => {
  const headers = getTcgapiHeaders();
  const page = Number.isFinite(options.page) ? Math.max(1, Math.floor(options.page)) : 1;
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(100, Math.floor(options.limit))) : 25;

  const url = `${TCGAPI_BASE_URL}/${franchiseId}/cards`;
  const { data } = await axios.get(url, {
    headers,
    timeout: 25000,
    params: {
      page,
      limit,
    },
  });

  return {
    page: Number(data?.page) || page,
    limit: Number(data?.limit) || limit,
    total: Number(data?.total) || 0,
    totalPages: Number(data?.totalPages) || 0,
    data: Array.isArray(data?.data) ? data.data : [],
  };
};

const getSupportedTcgapiFranchises = () =>
  Object.entries(SUPPORTED_TCGAPI_FRANCHISES).map(([id, name]) => ({ id, name }));

const normalizeTcgapiFranchiseId = (value) => {
  const slug = createSlug(value);
  if (!slug) return null;
  if (SUPPORTED_TCGAPI_FRANCHISES[slug]) return slug;
  return FRANCHISE_ALIASES[slug] || null;
};

const getTcgapiFranchiseName = (franchiseId) =>
  SUPPORTED_TCGAPI_FRANCHISES[franchiseId] || franchiseId;

const inferValueType = (value) => {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
};

const collectFieldTypes = (value, path, fieldTypeMap) => {
  const valueType = inferValueType(value);
  if (!fieldTypeMap[path]) {
    fieldTypeMap[path] = new Set();
  }
  fieldTypeMap[path].add(valueType);

  if (Array.isArray(value)) {
    const samples = value.slice(0, 3);
    for (const sample of samples) {
      const itemPath = `${path}[]`;
      collectFieldTypes(sample, itemPath, fieldTypeMap);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = `${path}.${key}`;
      collectFieldTypes(nestedValue, nestedPath, fieldTypeMap);
    }
  }
};

const buildFranchiseSchemaFromCards = (franchiseId, pagePayload) => {
  const cards = pagePayload.data.slice(0, TCGAPI_SCHEMA_SAMPLE_LIMIT);
  const fieldTypeMap = {};
  const topLevelFieldMap = {};

  for (const card of cards) {
    if (!card || typeof card !== "object") continue;
    for (const [key, value] of Object.entries(card)) {
      if (!topLevelFieldMap[key]) topLevelFieldMap[key] = new Set();
      topLevelFieldMap[key].add(inferValueType(value));
      collectFieldTypes(value, key, fieldTypeMap);
    }
  }

  const topLevelFields = Object.keys(topLevelFieldMap)
    .sort()
    .map((key) => ({ key, types: [...topLevelFieldMap[key]].sort() }));

  const fieldPaths = Object.keys(fieldTypeMap)
    .sort()
    .map((path) => ({ path, types: [...fieldTypeMap[path]].sort() }));

  const sampleCards = cards.map((card) => ({
    id: card?.id || card?.code || null,
    code: card?.code || null,
    name: card?.name || null,
    cardType: card?.cardType || card?.type || card?.supertype || null,
    setName: card?.set?.name || card?.setName || null,
  }));

  return {
    franchiseId,
    franchiseName: getTcgapiFranchiseName(franchiseId),
    endpoint: `${TCGAPI_BASE_URL}/${franchiseId}/cards`,
    status: "ok",
    totalCards: pagePayload.total,
    sampleSize: cards.length,
    topLevelFields,
    fieldPaths,
    sampleCards,
  };
};

const getTcgapiFranchiseCardSchema = async (franchiseId) => {
  try {
    const pagePayload = await getTcgapiCardsPage(franchiseId, {
      page: 1,
      limit: TCGAPI_SCHEMA_SAMPLE_LIMIT,
    });
    return buildFranchiseSchemaFromCards(franchiseId, pagePayload);
  } catch (error) {
    return {
      franchiseId,
      franchiseName: getTcgapiFranchiseName(franchiseId),
      endpoint: `${TCGAPI_BASE_URL}/${franchiseId}/cards`,
      status: "error",
      error: {
        message: error?.response?.data?.error || error?.message || "Unknown APITCG error",
        status: error?.response?.status || null,
      },
      totalCards: null,
      sampleSize: 0,
      topLevelFields: [],
      fieldPaths: [],
      sampleCards: [],
    };
  }
};

const fetchAllTcgapiFranchiseSchemas = async () => {
  const supported = getSupportedTcgapiFranchises();
  const schemas = await Promise.all(
    supported.map((franchise) => getTcgapiFranchiseCardSchema(franchise.id)),
  );

  return {
    generatedAt: new Date().toISOString(),
    cacheTtlMs: TCGAPI_SCHEMA_CACHE_TTL_MS,
    sampleLimit: TCGAPI_SCHEMA_SAMPLE_LIMIT,
    schemas,
  };
};

const getAllTcgapiFranchiseSchemas = async (options = {}) => {
  const forceRefresh = options.forceRefresh === true;
  const now = Date.now();

  if (!forceRefresh && cachedSchemaPayload && now - cachedSchemaAt < TCGAPI_SCHEMA_CACHE_TTL_MS) {
    return cachedSchemaPayload;
  }

  if (!forceRefresh && schemaFetchInFlight) {
    return schemaFetchInFlight;
  }

  schemaFetchInFlight = fetchAllTcgapiFranchiseSchemas()
    .then((payload) => {
      cachedSchemaPayload = payload;
      cachedSchemaAt = Date.now();
      return payload;
    })
    .finally(() => {
      schemaFetchInFlight = null;
    });

  return schemaFetchInFlight;
};

const extractCardFromApiResponse = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  if (payload.data && !Array.isArray(payload.data) && typeof payload.data === "object") {
    return payload.data;
  }

  if (Array.isArray(payload.data) && payload.data.length > 0) {
    return payload.data[0];
  }

  if (payload.id || payload.code || payload.name) {
    return payload;
  }

  return null;
};

const getTcgapiCardById = async (franchiseId, cardId) => {
  if (!franchiseId) {
    throw new Error("franchiseId is required.");
  }
  if (!cardId) {
    throw new Error("cardId is required.");
  }

  const headers = getTcgapiHeaders();
  const encodedCardId = encodeURIComponent(cardId);

  try {
    const singleCardUrl = `${TCGAPI_BASE_URL}/${franchiseId}/cards/${encodedCardId}`;
    const { data } = await axios.get(singleCardUrl, { headers, timeout: 20000 });
    const card = extractCardFromApiResponse(data);
    if (card) return card;
  } catch (error) {
    const status = error?.response?.status;
    if (status !== 404) throw error;
  }

  const queryUrl = `${TCGAPI_BASE_URL}/${franchiseId}/cards`;
  const { data } = await axios.get(queryUrl, {
    headers,
    timeout: 20000,
    params: { id: cardId, limit: 1, page: 1 },
  });

  const card = extractCardFromApiResponse(data);
  if (!card) {
    throw new Error(`Card '${cardId}' not found for franchise '${franchiseId}'.`);
  }

  return card;
};

const resolveTcgapiImageUrl = (card) => {
  if (!card || typeof card !== "object") return null;

  const candidates = [
    card?.images?.large,
    card?.images?.small,
    card?.image?.large,
    card?.image?.small,
    card?.imageUrl,
    card?.image,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) return candidate;
  }

  return null;
};

const toPriceNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Number(numeric.toFixed(2));
};

const getTcgapiMarketPriceFromCardData = (card) => {
  if (!card || typeof card !== "object") return null;

  const candidates = [
    card?.tcgplayer?.prices?.holofoil?.market,
    card?.tcgplayer?.prices?.normal?.market,
    card?.tcgplayer?.prices?.reverseHolofoil?.market,
    card?.cardmarket?.prices?.averageSellPrice,
    card?.cardmarket?.prices?.trendPrice,
    card?.price,
  ];

  for (const candidate of candidates) {
    const price = toPriceNumber(candidate);
    if (price !== null) return price;
  }

  return null;
};

const mapTcgapiCardToGlobalCard = (tcgapiCard, franchiseId) => {
  const sourceCardId = String(
    tcgapiCard?.id ||
      tcgapiCard?.code ||
      tcgapiCard?.cardId ||
      tcgapiCard?.uuid ||
      tcgapiCard?.number ||
      "",
  ).trim();

  if (!sourceCardId) {
    throw new Error("Unable to map card. Source card id is missing.");
  }

  const imageUrl = resolveTcgapiImageUrl(tcgapiCard);
  const nowIso = new Date().toISOString();
  const marketPrice = getTcgapiMarketPriceFromCardData(tcgapiCard);
  const setObject = tcgapiCard?.set && typeof tcgapiCard.set === "object" ? tcgapiCard.set : {};

  return {
    id: `${franchiseId}:${sourceCardId}`,
    partitionKey: franchiseId,
    franchiseId,
    name: tcgapiCard?.name || tcgapiCard?.title || sourceCardId,
    cardNumber: tcgapiCard?.number || tcgapiCard?.code || sourceCardId,
    tcgapiId: sourceCardId,
    tcgapiFranchise: franchiseId,
    setId: setObject?.id || tcgapiCard?.setId || null,
    setName: setObject?.name || tcgapiCard?.setName || null,
    illustrator: tcgapiCard?.artist || tcgapiCard?.illustrator || null,
    rarity: tcgapiCard?.rarity || null,
    hp: tcgapiCard?.hp || null,
    power: tcgapiCard?.power || tcgapiCard?.dp || null,
    types: Array.isArray(tcgapiCard?.types)
      ? tcgapiCard.types
      : Array.isArray(tcgapiCard?.colors)
        ? tcgapiCard.colors
        : [],
    attacks: Array.isArray(tcgapiCard?.attacks) ? tcgapiCard.attacks : [],
    weaknesses: Array.isArray(tcgapiCard?.weaknesses) ? tcgapiCard.weaknesses : [],
    retreat:
      tcgapiCard?.retreat ||
      tcgapiCard?.convertedRetreatCost ||
      (Array.isArray(tcgapiCard?.retreatCost) ? tcgapiCard.retreatCost.length : null),
    description:
      tcgapiCard?.description ||
      tcgapiCard?.text ||
      tcgapiCard?.effect ||
      tcgapiCard?.ability ||
      tcgapiCard?.flavorText ||
      "",
    imageUrl,
    source: "apitcg",
    currentPrice: marketPrice,
    lastPriceUpdate: marketPrice !== null ? nowIso : null,
    lastInteractedAt: nowIso,
    interactionCount: 1,
    createdAt: nowIso,
    verified: true,
  };
};

module.exports = {
  createSlug,
  getAllTcgapiFranchiseSchemas,
  getTcgapiCardsPage,
  getSupportedTcgapiFranchises,
  getTcgapiCardById,
  getTcgapiFranchiseCardSchema,
  getTcgapiFranchiseName,
  getTcgapiMarketPriceFromCardData,
  mapTcgapiCardToGlobalCard,
  normalizeTcgapiFranchiseId,
  resolveTcgapiImageUrl,
};
