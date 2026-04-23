const { app } = require("@azure/functions");
const { cardsContainer } = require("../functions/db");
const { withDisplayImageUrl } = require("../functions/blobUtils");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  cardsContainer: { items: { query: jest.fn() } },
}));
jest.mock("../functions/blobUtils", () => ({
  withDisplayImageUrl: jest.fn((item) => Promise.resolve(item)), // passthrough
}));

describe("getGlobalCards API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/getGlobalCards");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch global cards with default limit when no query params are provided", async () => {
    const request = { query: { get: jest.fn().mockReturnValue(null) } };
    const context = { log: jest.fn() };
    
    cardsContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [{ id: "pokemon:pikachu" }] }) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    expect(res.jsonBody.count).toBe(1);
    expect(cardsContainer.items.query.mock.calls[0][0].query).toContain("SELECT TOP 50");
  });

  it("should apply franchise and search filters and custom limit", async () => {
    const request = { 
      query: { 
        get: jest.fn().mockImplementation((key) => {
          if (key === "franchise") return "pokemon";
          if (key === "search") return "pika";
          if (key === "limit") return "10";
          return null;
        }) 
      } 
    };
    const context = { log: jest.fn() };
    
    cardsContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    
    const querySpec = cardsContainer.items.query.mock.calls[0][0];
    expect(querySpec.query).toContain("SELECT TOP 10");
    expect(querySpec.query).toContain("c.franchiseId = @franchiseId");
    expect(querySpec.query).toContain("CONTAINS(LOWER(c.name), @search)");
    expect(querySpec.parameters).toEqual(expect.arrayContaining([
      { name: "@franchiseId", value: "pokemon" },
      { name: "@search", value: "pika" }
    ]));
  });

  it("should return 500 on server error", async () => {
    const request = { query: { get: jest.fn().mockReturnValue(null) } };
    const context = { log: jest.fn() };
    
    cardsContainer.items.query.mockImplementation(() => { throw new Error("DB Crash"); });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB Crash");
  });
});