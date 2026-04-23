const { app } = require("@azure/functions");
const { cardsContainer, franchisesContainer, bindersContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");
const { uploadImageFromUrl, withDisplayImageUrl } = require("../functions/blobUtils");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  cardsContainer: { item: jest.fn(), items: { create: jest.fn() } },
  franchisesContainer: { item: jest.fn() },
  bindersContainer: { items: { query: jest.fn(), create: jest.fn() } },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));
jest.mock("../functions/blobUtils", () => ({
  getBlobNameFromUrl: jest.fn(),
  uploadImageFromUrl: jest.fn(),
  withDisplayImageUrl: jest.fn((item) => Promise.resolve(item)), // passthrough
}));

describe("addGlobalCard API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/addGlobalCard");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if name or franchiseName is missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({}) };
    const context = { log: jest.fn() };
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Card Name and Franchise are required.");
  });

  it("should return 400 if name or franchiseName creates an invalid slug", async () => {
    const request = { json: jest.fn().mockResolvedValue({ name: "!!!", franchiseName: "@@@" }) };
    const context = { log: jest.fn() };
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Card Name or Franchise contains invalid characters.");
  });

  it("should return 403 if auth fails", async () => {
    const request = { json: jest.fn().mockResolvedValue({ name: "Pikachu", franchiseName: "Pokemon", username: "ash" }) };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: false, response: { status: 403 } });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(403);
  });

  it("should return 404 if franchise does not exist", async () => {
    const request = { json: jest.fn().mockResolvedValue({ name: "Pikachu", franchiseName: "Pokemon" }) };
    const context = { log: jest.fn() };
    const notFoundErr = new Error("Not Found"); notFoundErr.code = 404;
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundErr) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(404);
  });

  it("should return 409 if card already exists", async () => {
    const request = { json: jest.fn().mockResolvedValue({ name: "Pikachu", franchiseName: "Pokemon" }) };
    const context = { log: jest.fn() };
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon:pikachu" } }) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(409);
  });

  it("should successfully create card and auto-add to binder", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ 
        name: "Pikachu", franchiseName: "Pokemon", username: "ash", imageUrl: "http://test.com/pika.png", customData: { rarity: "Rare" } 
      }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });
    const notFoundErr = new Error("Not Found"); notFoundErr.code = 404;
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundErr) });
    
    uploadImageFromUrl.mockResolvedValue({ url: "blob_url", blobName: "blob_name" });
    cardsContainer.items.create.mockResolvedValue({ resource: { id: "pokemon:pikachu", rarity: "Rare" } });
    
    bindersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) });
    bindersContainer.items.create.mockResolvedValue({ resource: { id: "binder_123" } });
    
    const res = await handler(request, context);
    expect(res.status).toBe(201);
    expect(res.jsonBody.binderEntry).toBeDefined();
    expect(bindersContainer.items.create).toHaveBeenCalled();
  });

  it("should fallback to original image URL if blob upload fails", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ 
        name: "Pikachu", franchiseName: "Pokemon", imageUrl: "http://test.com/pika.png"
      }) 
    };
    const context = { log: jest.fn() };
    
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });
    const notFoundErr = new Error("Not Found"); notFoundErr.code = 404;
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundErr) });
    
    uploadImageFromUrl.mockRejectedValue(new Error("Upload failed"));
    cardsContainer.items.create.mockResolvedValue({ resource: { id: "pokemon:pikachu" } });
    
    const res = await handler(request, context);
    expect(res.status).toBe(201);
    expect(context.log).toHaveBeenCalledWith(expect.stringContaining("Image upload to Blob failed"), "Upload failed");
  });

  it("should return 500 on server error", async () => {
    const request = { json: jest.fn().mockResolvedValue({ name: "Pikachu", franchiseName: "Pokemon" }) };
    const context = { log: jest.fn() };
    franchisesContainer.item.mockImplementation(() => { throw new Error("DB Crash"); });
    const res = await handler(request, context);
    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB Crash");
  });
});
