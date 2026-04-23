const { app } = require("@azure/functions");
const { usersContainer, bindersContainer, cardsContainer } = require("../functions/db");
const { authenticateRequest } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  usersContainer: { items: { query: jest.fn() } },
  bindersContainer: { items: { query: jest.fn() } },
  cardsContainer: { items: { query: jest.fn() } },
}));
jest.mock("../functions/auth", () => ({ authenticateRequest: jest.fn() }));

describe("getProfile API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/getProfile");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if user parameter is missing", async () => {
    const request = { query: { get: jest.fn().mockReturnValue(null) } };
    const context = { log: jest.fn() };
    authenticateRequest.mockReturnValue({ ok: true });

    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("User parameter is required");
  });

  it("should return auth error if authentication fails", async () => {
    const request = { query: { get: jest.fn().mockReturnValue("ashketchum") } };
    const context = { log: jest.fn() };
    authenticateRequest.mockReturnValue({ ok: false, response: { status: 401, jsonBody: { error: "Auth failed" } } });

    const res = await handler(request, context);
    
    expect(res.status).toBe(401);
    expect(res.jsonBody.error).toBe("Auth failed");
  });

  it("should return 404 if target user is not found", async () => {
    const request = { query: { get: jest.fn().mockReturnValue("ashketchum") } };
    const context = { log: jest.fn() };
    authenticateRequest.mockReturnValue({ ok: true, user: null });
    usersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) });

    const res = await handler(request, context);
    
    expect(res.status).toBe(404);
    expect(res.jsonBody.error).toBe("Trainer not found");
  });

  it("should return profile without binder if binder is private and requester is not owner", async () => {
    const request = { query: { get: jest.fn().mockReturnValue("ashketchum") } };
    const context = { log: jest.fn() };
    authenticateRequest.mockReturnValue({ ok: true, user: { username: "brock" } }); // Requesting user is brock
    
    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [{ username: "ashketchum", binderIsPrivate: true }] })
    });

    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    expect(res.jsonBody.isBinderHidden).toBe(true);
    expect(res.jsonBody.binder).toEqual([]);
    expect(bindersContainer.items.query).not.toHaveBeenCalled();
  });

  it("should return profile with hydrated binder if public", async () => {
    const request = { query: { get: jest.fn().mockReturnValue("ashketchum") } };
    const context = { log: jest.fn() };
    authenticateRequest.mockReturnValue({ ok: true, user: null }); // Anonymous user
    
    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [{ username: "ashketchum", binderIsPrivate: false }] })
    });
    bindersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [{ globalCardId: "pokemon:123" }] })
    });
    cardsContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [{ id: "pokemon:123", currentPrice: 150 }] })
    });

    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    expect(res.jsonBody.isBinderHidden).toBe(false);
    expect(res.jsonBody.binder.length).toBe(1);
    expect(res.jsonBody.binder[0].currentPrice).toBe(150);
  });

  it("should return 500 on server error", async () => {
    const request = { query: { get: jest.fn().mockReturnValue("ashketchum") } };
    const context = { log: jest.fn() };
    authenticateRequest.mockReturnValue({ ok: true, user: null });
    
    usersContainer.items.query.mockImplementation(() => { throw new Error("DB offline"); });

    const res = await handler(request, context);
    
    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB offline");
  });
});