const { app } = require("@azure/functions");
const { bindersContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  bindersContainer: { item: jest.fn() },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));

describe("removeFromBinder API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/removeFromBinder");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if binderId or username is missing", async () => {
    const request = { query: { get: jest.fn().mockReturnValue(null) } };
    const context = { log: jest.fn() };
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toContain("parameters are required");
  });

  it("should return auth error if authorization fails", async () => {
    const request = { 
      query: { 
        get: jest.fn().mockImplementation((k) => k === "username" ? "ashketchum" : "binder_123") 
      } 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: false, response: { status: 403, jsonBody: { error: "Forbidden" } } });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(403);
  });

  it("should return 404 if binder entry is not found", async () => {
    const request = { 
      query: { 
        get: jest.fn().mockImplementation((k) => k === "username" ? "ashketchum" : "binder_123") 
      } 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    const notFoundErr = new Error("Not found");
    notFoundErr.code = 404;
    bindersContainer.item.mockReturnValue({ delete: jest.fn().mockRejectedValue(notFoundErr) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(404);
    expect(res.jsonBody.error).toBe("Binder entry not found.");
  });

  it("should return 200 on successful deletion", async () => {
    const request = { 
      query: { 
        get: jest.fn().mockImplementation((k) => k === "username" ? "ashketchum" : "binder_123") 
      } 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    bindersContainer.item.mockReturnValue({ delete: jest.fn().mockResolvedValue({}) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    expect(res.jsonBody.success).toBe(true);
    expect(bindersContainer.item).toHaveBeenCalledWith("binder_123", "ashketchum");
  });

  it("should return 500 on server error", async () => {
    const request = { 
      query: { 
        get: jest.fn().mockImplementation((k) => k === "username" ? "ashketchum" : "binder_123") 
      } 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    const dbErr = new Error("DB Offline");
    dbErr.code = 500;
    bindersContainer.item.mockReturnValue({ delete: jest.fn().mockRejectedValue(dbErr) });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB Offline");
  });
});