const { app } = require("@azure/functions");
const { usersContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  usersContainer: {
    items: { query: jest.fn() },
    item: jest.fn()
  },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));

describe("updateProfile API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/updateProfile");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if username is missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({ bio: "Hello" }) };
    const context = { log: jest.fn() };

    const res = await handler(request, context);

    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Username is required.");
  });

  it("should return auth error if authorization fails", async () => {
    const request = { json: jest.fn().mockResolvedValue({ username: "ashketchum" }) };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({
      ok: false,
      response: { status: 403, jsonBody: { error: "Forbidden" } }
    });

    const res = await handler(request, context);

    expect(res.status).toBe(403);
    expect(res.jsonBody.error).toBe("Forbidden");
  });

  it("should return 404 if user is not found", async () => {
    const request = { json: jest.fn().mockResolvedValue({ username: "ashketchum" }) };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({ ok: true });
    usersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [] }) });

    const res = await handler(request, context);

    expect(res.status).toBe(404);
    expect(res.jsonBody.error).toBe("User not found.");
  });

  it("should update user profile successfully", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({
        username: "ashketchum", binderIsPrivate: true, bio: "New bio!", displayName: " Ash Ketchum "
      })
    };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({ ok: true });

    const existingUser = { id: "user_123", username: "ashketchum", bio: "Old", binderIsPrivate: false };
    usersContainer.items.query.mockReturnValue({ fetchAll: jest.fn().mockResolvedValue({ resources: [existingUser] }) });

    // Mock the document replace call
    usersContainer.item.mockReturnValue({
      replace: jest.fn().mockResolvedValue({
        resource: { id: "user_123", username: "ashketchum", bio: "New bio!", displayName: "Ash Ketchum", binderIsPrivate: true }
      })
    });

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(res.jsonBody.success).toBe(true);
    expect(res.jsonBody.user.bio).toBe("New bio!");
    expect(res.jsonBody.user.displayName).toBe("Ash Ketchum");
    expect(res.jsonBody.user.binderIsPrivate).toBe(true);

    // Verify it called replace on the correct Cosmos DB document
    expect(usersContainer.item).toHaveBeenCalledWith("user_123", "user_123");
  });

  it("should return 500 on server error", async () => {
    const request = { json: jest.fn().mockResolvedValue({ username: "ashketchum" }) };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({ ok: true });
    usersContainer.items.query.mockImplementation(() => { throw new Error("DB offline"); });

    const res = await handler(request, context);

    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB offline");
  });
});
