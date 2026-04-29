const axios = require("axios");
const {
  createSlug,
  normalizeTcgapiFranchiseId,
  getTcgapiCardById,
  mapTcgapiCardToGlobalCard,
  getSupportedTcgapiFranchises,
  getTcgapiFranchiseName,
  getTcgapiCardsPage,
  getTcgapiFranchiseCardSchema,
  getAllTcgapiFranchiseSchemas,
  resolveTcgapiImageUrl,
  getTcgapiMarketPriceFromCardData,
} = require("../functions/tcgapiUtils");

// Mock axios so we don't make real network requests
jest.mock("axios");

describe("TCG API Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure the API key is mocked so getTcgapiHeaders doesn't throw an error
    process.env = { ...originalEnv, APITCG_API_KEY: "test_mock_api_key" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Franchise Info Utilities", () => {
    it("should return a list of supported franchises", () => {
      const franchises = getSupportedTcgapiFranchises();
      expect(franchises.length).toBeGreaterThan(0);
      expect(franchises[0]).toHaveProperty("id");
      expect(franchises[0]).toHaveProperty("name");
      expect(getTcgapiFranchiseName("pokemon")).toBe("Pokemon");
    });
  });

  describe("Franchise ID Normalization", () => {
    it("should create accurate slugs", () => {
      expect(createSlug("One Piece!")).toBe("one-piece");
      expect(createSlug("  Dragon Ball  ")).toBe("dragon-ball");
    });

    it("should resolve valid franchise IDs and aliases", () => {
      expect(normalizeTcgapiFranchiseId("Pokemon")).toBe("pokemon");
      expect(normalizeTcgapiFranchiseId("starwarsunlimited")).toBe("star-wars-unlimited");
      expect(normalizeTcgapiFranchiseId("unknown-tcg")).toBeNull();
    });
  });

  describe("getTcgapiCardsPage", () => {
    it("should fetch a page of cards and map pagination metadata", async () => {
      const mockResponse = { data: { page: 1, limit: 10, total: 100, totalPages: 10, data: [{ id: "card1" }] } };
      axios.get.mockResolvedValueOnce(mockResponse);

      const result = await getTcgapiCardsPage("pokemon", { page: 1, limit: 10 });
      expect(result.total).toBe(100);
    });
  });

  describe("getTcgapiCardById", () => {
    it("should fetch and extract a card successfully", async () => {
      const mockCard = { id: "base1-4", name: "Charizard" };

      // Mock a successful axios response
      axios.get.mockResolvedValue({ data: { data: [mockCard] } });

      const card = await getTcgapiCardById("pokemon", "base1-4");

      expect(card).toEqual(mockCard);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get.mock.calls[0][0]).toContain("/pokemon/cards/base1-4");
    });

    it("should throw an error if the API key is missing", async () => {
      delete process.env.APITCG_API_KEY;
      await expect(getTcgapiCardById("pokemon", "base1-4")).rejects.toThrow("Missing APITCG_API_KEY");
    });

    it("should extract card from nested top-level objects or arrays", async () => {
      axios.get.mockResolvedValueOnce({ data: { data: { id: "123", name: "Mew" } } });
      const card = await getTcgapiCardById("pokemon", "123");
      expect(card.name).toBe("Mew");
    });

    it("should fallback to search query if direct fetch returns 404", async () => {
      const error404 = new Error("Not Found");
      error404.response = { status: 404 };
      axios.get.mockRejectedValueOnce(error404); // first call fails
      axios.get.mockResolvedValueOnce({ data: { data: [{ id: "fallback-id", name: "Fallback" }] } }); // fallback succeeds
      const card = await getTcgapiCardById("pokemon", "fallback-id");
      expect(card.name).toBe("Fallback");
    });
  });

  describe("mapTcgapiCardToGlobalCard", () => {
    it("should accurately map a TCG API card payload to the Cosmos DB schema", () => {
      const tcgapiCard = {
        id: "base1-4",
        name: "Charizard",
        supertype: "Pokémon",
        hp: "120",
        types: ["Fire"],
        images: { small: "http://example.com/charizard-small.png" },
        tcgplayer: { prices: { holofoil: { market: 150.50 } } },
        set: { id: "base1", name: "Base Set" }
      };

      const globalCard = mapTcgapiCardToGlobalCard(tcgapiCard, "pokemon");

      expect(globalCard.id).toBe("pokemon:base1-4");
      expect(globalCard.partitionKey).toBe("pokemon");
      expect(globalCard.name).toBe("Charizard");
      expect(globalCard.hp).toBe("120");
      expect(globalCard.types).toEqual(["Fire"]);
      expect(globalCard.imageUrl).toBe("http://example.com/charizard-small.png");
      expect(globalCard.currentPrice).toBe(150.50);
      expect(globalCard.setId).toBe("base1");
      expect(globalCard.verified).toBe(true);
    });

    it("should extract market prices from various potential API fields", () => {
      const cardWithCardmarketPrice = { id: "123", cardmarket: { prices: { trendPrice: 12.99 } } };
      const globalCard = mapTcgapiCardToGlobalCard(cardWithCardmarketPrice, "digimon");
      expect(globalCard.currentPrice).toBe(12.99);
    });

    it("should throw an error if the card has no identifying ID", () => {
      expect(() => mapTcgapiCardToGlobalCard({}, "pokemon")).toThrow("Unable to map card");
    });

    it("should fallback to alternative fields for types and retreat costs", () => {
      const alternativeCard = { id: "123", colors: ["Blue"], convertedRetreatCost: 2 };
      const globalCard = mapTcgapiCardToGlobalCard(alternativeCard, "magic");
      expect(globalCard.types).toEqual(["Blue"]);
      expect(globalCard.retreat).toBe(2);
    });
  });

  describe("Data Extraction Utilities", () => {
    it("should resolve image urls from different possible payload locations", () => {
      expect(resolveTcgapiImageUrl({ images: { large: "url1" } })).toBe("url1");
      expect(resolveTcgapiImageUrl({ image: { small: "url2" } })).toBe("url2");
      expect(resolveTcgapiImageUrl({ imageUrl: "url3" })).toBe("url3");
      expect(resolveTcgapiImageUrl({})).toBeNull();
    });

    it("should resolve market prices accurately", () => {
      expect(getTcgapiMarketPriceFromCardData({ tcgplayer: { prices: { normal: { market: 10.5 } } } })).toBe(10.5);
      expect(getTcgapiMarketPriceFromCardData({ price: "5.99" })).toBe(5.99);
      expect(getTcgapiMarketPriceFromCardData({ price: "invalid" })).toBeNull();
      expect(getTcgapiMarketPriceFromCardData({})).toBeNull();
    });
  });

  describe("Schema Generation", () => {
    it("should build a schema from an array of franchise cards", async () => {
      const mockCardsResponse = {
        data: {
          total: 1,
          data: [{ id: "1", name: "Pikachu", types: ["Electric"], hp: 60, abilities: [{ name: "Static" }] }]
        }
      };
      axios.get.mockResolvedValueOnce(mockCardsResponse);

      const schema = await getTcgapiFranchiseCardSchema("pokemon");
      expect(schema.status).toBe("ok");
      expect(schema.franchiseId).toBe("pokemon");
      expect(schema.topLevelFields.some(f => f.key === "types")).toBe(true);
      expect(schema.fieldPaths.some(p => p.path === "abilities[].name")).toBe(true);
    });

    it("should handle schema generation errors gracefully", async () => {
      axios.get.mockRejectedValueOnce(new Error("API Outage"));
      const schema = await getTcgapiFranchiseCardSchema("pokemon");
      expect(schema.status).toBe("error");
      expect(schema.error.message).toBe("API Outage");
    });

    it("should fetch all schemas and cache them on subsequent calls", async () => {
      axios.get.mockResolvedValue({ data: { total: 0, data: [] } });
      const result1 = await getAllTcgapiFranchiseSchemas({ forceRefresh: true });
      const result2 = await getAllTcgapiFranchiseSchemas({ forceRefresh: false });

      expect(result1).toBe(result2); // Exact equality means it hit the cache
    });
  });
});
