const { app } = require("@azure/functions");
const { bindersContainer, cardsContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");
const { withDisplayImageUrl } = require("../functions/blobUtils");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  bindersContainer: { items: { query: jest.fn(), create: jest.fn() } },
  cardsContainer: { item: jest.fn() },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));
jest.mock("../functions/blobUtils", () => ({
  withDisplayImageUrl: jest.fn((item) => Promise.resolve(item)), // passthrough
}));

describe("addToBinder API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/addToBinder");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if required fields are missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({ username: "ashketchum" }) }; // Missing globalCardId and franchiseId
    const context = { log: jest.fn() };
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Missing required fields.");
  });

  it("should return auth error if authorization fails", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ username: "ashketchum", globalCardId: "poke:1", franchiseId: "pokemon" }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: false, response: { status: 403, jsonBody: { error: "Forbidden" } } });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(403);
  });

  it("should return 404 if global card does not exist", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ username: "ashketchum", globalCardId: "poke:1", franchiseId: "pokemon" }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    const notFoundErr = new Error("Not found");
    notFoundErr.code = 404;
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundErr) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(404);
    expect(res.jsonBody.error).toBe("That card does not exist in the database.");
  });

  it("should return 409 if card is already in the binder", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ username: "ashketchum", globalCardId: "poke:1", franchiseId: "pokemon" }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "poke:1", name: "Pikachu" } }) });
    bindersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [{ id: "existing_entry" }] }) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(409);
    expect(res.jsonBody.error).toBe("This card is already in your binder.");
  });

  it("should successfully add card to binder", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ username: "ashketchum", globalCardId: "poke:1", franchiseId: "pokemon" }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    cardsContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "poke:1", name: "Pikachu", imageUrl: "img.png" } }) });
    bindersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) });
    bindersContainer.items.create.mockResolvedValue({ resource: { id: "new_binder_entry", cardName: "Pikachu" } });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(201);
    expect(res.jsonBody.success).toBe(true);
    expect(res.jsonBody.entry.cardName).toBe("Pikachu");
    expect(bindersContainer.items.create).toHaveBeenCalled();
  });

  it("should return 500 on server error", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ username: "ashketchum", globalCardId: "poke:1", franchiseId: "pokemon" }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    cardsContainer.item.mockImplementation(() => { throw new Error("DB Crash"); });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB Crash");
  });
});