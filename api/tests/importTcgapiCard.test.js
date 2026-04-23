const { app } = require("@azure/functions");
const { cardsContainer, bindersContainer, franchisesContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");
const { getBlobNameFromUrl, uploadImageFromUrl, withDisplayImageUrl } = require("../functions/blobUtils");
const {
  createSlug,
  getSupportedTcgapiFranchises,
  getTcgapiCardById,
  getTcgapiFranchiseName,
  mapTcgapiCardToGlobalCard,
  normalizeTcgapiFranchiseId,
} = require("../functions/tcgapiUtils");

// 1. Mock all dependencies
jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));

jest.mock("../functions/db", () => ({
  cardsContainer: { item: jest.fn(), items: { upsert: jest.fn() } },
  bindersContainer: { items: { query: jest.fn(), create: jest.fn() } },
  franchisesContainer: { item: jest.fn(), items: { upsert: jest.fn() } },
}));

jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));

jest.mock("../functions/blobUtils", () => ({
  getBlobNameFromUrl: jest.fn(),
  uploadImageFromUrl: jest.fn(),
  withDisplayImageUrl: jest.fn((item) => Promise.resolve(item)), // passthrough for testing
}));

jest.mock("../functions/tcgapiUtils", () => ({
  createSlug: jest.fn((str) => str),
  getSupportedTcgapiFranchises: jest.fn(() => [{ id: "pokemon", name: "Pokemon" }]),
  getTcgapiCardById: jest.fn(),
  getTcgapiFranchiseName: jest.fn(() => "Pokemon"),
  mapTcgapiCardToGlobalCard: jest.fn(),
  normalizeTcgapiFranchiseId: jest.fn(),
}));

describe("importTcgapiCard API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/importTcgapiCard");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if cardId is missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({}) };
    const context = { log: jest.fn() };
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toContain("cardId is required");
  });

  it("should return 400 if franchise is unsupported", async () => {
    const request = { json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "fake-tcg" }) };
    const context = { log: jest.fn() };
    
    normalizeTcgapiFranchiseId.mockReturnValue(null);
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toContain("Unsupported franchise");
  });

  it("should return 404 if card is not found in TCG API", async () => {
    const request = { json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "pokemon" }) };
    const context = { log: jest.fn() };
    
    normalizeTcgapiFranchiseId.mockReturnValue("pokemon");
    getTcgapiCardById.mockResolvedValue(null);
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(404);
    expect(res.jsonBody.error).toContain("Card not found");
  });

  it("should import card successfully (201) without adding to binder", async () => {
    const request = { json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "pokemon", uploadImageToBlob: true }) };
    const context = { log: jest.fn() };
    
    normalizeTcgapiFranchiseId.mockReturnValue("pokemon");
    getTcgapiCardById.mockResolvedValue({ id: "123", name: "Pikachu" });
    mapTcgapiCardToGlobalCard.mockReturnValue({
      id: "pokemon:123",
      partitionKey: "pokemon",
      franchiseId: "pokemon",
      name: "Pikachu",
      imageUrl: "http://example.com/pika.png",
    });

    // Mock franchise already exists
    franchisesContainer.item.mockReturnValue({
      read: jest.fn().mockResolvedValue({ resource: { id: "pokemon", name: "Pokemon" } })
    });
    
    // Mock global card does NOT exist yet
    const notFoundError = new Error("Not Found");
    notFoundError.code = 404;
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundError) });

    uploadImageFromUrl.mockResolvedValue({ url: "uploaded_blob_url", blobName: "cards/pokemon/123.png" });
    cardsContainer.items.upsert.mockResolvedValue({ resource: { id: "pokemon:123", name: "Pikachu" } });

    const res = await handler(request, context);

    expect(res.status).toBe(201);
    expect(uploadImageFromUrl).toHaveBeenCalled();
    expect(cardsContainer.items.upsert).toHaveBeenCalled();
    expect(res.jsonBody.wasExisting).toBe(false);
  });

  it("should return 200, update card, and add to binder if requested", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "pokemon", username: "ashketchum", addToBinder: true }) 
    };
    const context = { log: jest.fn() };
    
    authorizeUsername.mockReturnValue({ ok: true });
    normalizeTcgapiFranchiseId.mockReturnValue("pokemon");
    getTcgapiCardById.mockResolvedValue({ id: "123", name: "Pikachu" });
    mapTcgapiCardToGlobalCard.mockReturnValue({
      id: "pokemon:123",
      partitionKey: "pokemon",
      franchiseId: "pokemon",
      name: "Pikachu",
    });

    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });
    
    // Mock card already EXISTING in database (triggers 200 status instead of 201)
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon:123", name: "Pikachu" } }) });
    cardsContainer.items.upsert.mockResolvedValue({ resource: { id: "pokemon:123", name: "Pikachu", franchiseId: "pokemon" } });

    // Mock binder duplicate check (empty array = not in binder yet)
    bindersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) });
    bindersContainer.items.create.mockResolvedValue({ resource: { id: "collection_123" } });

    const res = await handler(request, context);

    expect(res.status).toBe(200); // 200 because it was an update to an existing card
    expect(res.jsonBody.wasExisting).toBe(true);
    expect(bindersContainer.items.create).toHaveBeenCalled();
    expect(res.jsonBody.binderEntry).toEqual({ id: "collection_123" });
  });

  it("should create a new franchise if it does not exist in the database", async () => {
    const request = { json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "pokemon" }) };
    const context = { log: jest.fn() };
    
    normalizeTcgapiFranchiseId.mockReturnValue("pokemon");
    getTcgapiCardById.mockResolvedValue({ id: "123", name: "Pikachu" });
    mapTcgapiCardToGlobalCard.mockReturnValue({
      id: "pokemon:123", partitionKey: "pokemon", franchiseId: "pokemon", name: "Pikachu",
    });

    // Mock franchise NOT existing (404)
    const notFoundError = new Error("Not Found");
    notFoundError.code = 404;
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundError) });
    franchisesContainer.items.upsert.mockResolvedValue({ resource: { id: "pokemon", name: "Pokemon" } });

    // Mock card NOT existing
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundError) });
    cardsContainer.items.upsert.mockResolvedValue({ resource: { id: "pokemon:123", name: "Pikachu" } });

    const res = await handler(request, context);

    expect(res.status).toBe(201);
    expect(franchisesContainer.items.upsert).toHaveBeenCalled();
  });

  it("should skip image upload if uploadImageToBlob is false and card already has a blobName", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "pokemon", uploadImageToBlob: false }) 
    };
    const context = { log: jest.fn() };
    
    normalizeTcgapiFranchiseId.mockReturnValue("pokemon");
    getTcgapiCardById.mockResolvedValue({ id: "123", name: "Pikachu" });
    mapTcgapiCardToGlobalCard.mockReturnValue({
      id: "pokemon:123", partitionKey: "pokemon", franchiseId: "pokemon", name: "Pikachu", imageUrl: "http://example.com/pika.png",
    });

    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });
    
    // Mock card EXISTING with a blobName
    cardsContainer.item.mockReturnValue({ 
      read: jest.fn().mockResolvedValue({ resource: { id: "pokemon:123", blobName: "existing_blob.png", imageUrl: "existing_url.png" } }) 
    });
    cardsContainer.items.upsert.mockResolvedValue({ resource: { id: "pokemon:123" } });

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(uploadImageFromUrl).not.toHaveBeenCalled();
    // Check upsert payload utilized existing_blob.png
    expect(cardsContainer.items.upsert.mock.calls[0][0].blobName).toBe("existing_blob.png");
  });

  it("should return 500 if a severe database read error occurs", async () => {
    const request = { json: jest.fn().mockResolvedValue({ cardId: "123", franchiseId: "pokemon" }) };
    const context = { log: jest.fn() };
    
    normalizeTcgapiFranchiseId.mockReturnValue("pokemon");
    getTcgapiCardById.mockResolvedValue({ id: "123", name: "Pikachu" });
    mapTcgapiCardToGlobalCard.mockReturnValue({ id: "pokemon:123" });
    
    // Mock franchise read successfully
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });

    // Mock a severe DB error (not a 404) when reading the card
    const dbError = new Error("Database offline");
    dbError.code = 502;
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(dbError) });

    const res = await handler(request, context);

    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("Database offline");
  });
});