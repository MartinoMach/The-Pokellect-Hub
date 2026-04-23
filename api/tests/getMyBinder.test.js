const { app } = require("@azure/functions");
const { bindersContainer, cardsContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");
const { withDisplayImageUrl } = require("../functions/blobUtils");

jest.mock("@azure/functions", () => ({
  app: {
    http: jest.fn(),
  },
}));

jest.mock("../functions/db", () => ({
  bindersContainer: {
    items: {
      query: jest.fn(),
    },
  },
  cardsContainer: {
    items: {
      query: jest.fn(),
    },
  },
}));

jest.mock("../functions/auth", () => ({
  authorizeUsername: jest.fn(),
}));

jest.mock("../functions/blobUtils", () => ({
  withDisplayImageUrl: jest.fn((item) => Promise.resolve({ ...item, imageUrl: "mocked_sas_url" })),
}));

describe("GetMyBinder API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/getMyBinder");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if username is missing", async () => {
    const request = {
      query: { get: jest.fn().mockReturnValue(null) }, // No username
    };
    const context = { log: jest.fn() };

    const response = await handler(request, context);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error).toBe("Username is required.");
  });

  it("should return auth error if authorization fails", async () => {
    const request = {
      query: { get: jest.fn().mockImplementation((key) => (key === "username" ? "ashketchum" : null)) },
    };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({
      ok: false,
      response: { status: 403, jsonBody: { error: "Forbidden" } },
    });

    const response = await handler(request, context);

    expect(response.status).toBe(403);
    expect(response.jsonBody.error).toBe("Forbidden");
  });

  it("should return empty array if binder is empty", async () => {
    const request = {
      query: { get: jest.fn().mockImplementation((key) => (key === "username" ? "ashketchum" : null)) },
    };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({ ok: true });
    bindersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
    });

    const response = await handler(request, context);

    expect(response.status).toBe(200);
    expect(response.jsonBody.count).toBe(0);
    expect(response.jsonBody.binder).toEqual([]);
  });

  it("should return hydrated binder entries", async () => {
    const request = {
      query: { 
        get: jest.fn().mockImplementation((key) => {
          if (key === "username") return "ashketchum";
          if (key === "franchise") return "pokemon";
          return null;
        }) 
      },
    };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({ ok: true });

    // Mock binder entries returning from Cosmos DB
    bindersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({
        resources: [
          { id: "entry_1", owner: "ashketchum", globalCardId: "pokemon:charizard", franchiseId: "pokemon" },
        ],
      }),
    });

    // Mock global cards returning from Cosmos DB to test price hydration
    cardsContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({
        resources: [
          { id: "pokemon:charizard", currentPrice: 150.00, imageUrl: "raw_image_url" },
        ],
      }),
    });

    const response = await handler(request, context);

    expect(response.status).toBe(200);
    expect(response.jsonBody.count).toBe(1);
    
    // Verify hydration logic (currentPrice merged from global card)
    expect(response.jsonBody.binder[0].currentPrice).toBe(150.00);
    
    // Verify withDisplayImageUrl was called properly
    expect(withDisplayImageUrl).toHaveBeenCalled();
    expect(response.jsonBody.binder[0].imageUrl).toBe("mocked_sas_url");
    
    // Verify franchise filter was added to the DB query string
    const queryCall = bindersContainer.items.query.mock.calls[0][0];
    expect(queryCall.query).toContain("c.franchiseId = @franchiseId");
  });
});