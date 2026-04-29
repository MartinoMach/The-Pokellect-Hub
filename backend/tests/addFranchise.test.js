const { app } = require("@azure/functions");
const { franchisesContainer } = require("../functions/db");
const { createSlug } = require("../functions/tcgapiUtils");
const { requireAuthenticatedUser } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  franchisesContainer: { item: jest.fn(), items: { create: jest.fn() } },
}));
jest.mock("../functions/tcgapiUtils", () => ({
  createSlug: jest.fn(),
}));
jest.mock("../functions/auth", () => ({
  requireAuthenticatedUser: jest.fn(),
}));

describe("addFranchise API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/addFranchise");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return auth error if unauthenticated", async () => {
    const request = { json: jest.fn() };
    const context = { log: jest.fn() };
    requireAuthenticatedUser.mockReturnValue({ ok: false, response: { status: 401, jsonBody: { error: "Auth required" } } });

    const res = await handler(request, context);

    expect(res.status).toBe(401);
    expect(res.jsonBody.error).toBe("Auth required");
  });

  it("should return 400 if franchiseName is missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({}) };
    const context = { log: jest.fn() };
    requireAuthenticatedUser.mockReturnValue({ ok: true, user: { username: "ash" } });

    const res = await handler(request, context);
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Franchise name is required.");
  });

  it("should return 400 if slug generation fails", async () => {
    const request = { json: jest.fn().mockResolvedValue({ franchiseName: "!!!" }) };
    const context = { log: jest.fn() };
    requireAuthenticatedUser.mockReturnValue({ ok: true, user: { username: "ash" } });
    createSlug.mockReturnValue("");

    const res = await handler(request, context);
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Invalid franchise name.");
  });

  it("should return 409 if franchise already exists", async () => {
    const request = { json: jest.fn().mockResolvedValue({ franchiseName: "Pokemon" }) };
    const context = { log: jest.fn() };
    requireAuthenticatedUser.mockReturnValue({ ok: true, user: { username: "ash" } });
    createSlug.mockReturnValue("pokemon");

    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockResolvedValue({ resource: { id: "pokemon" } }) });

    const res = await handler(request, context);
    expect(res.status).toBe(409);
    expect(res.jsonBody.error).toBe("Franchise already exists!");
  });

  it("should return 201 on success", async () => {
    const request = { json: jest.fn().mockResolvedValue({ franchiseName: "Pokemon", addedBy: "brock" }) };
    const context = { log: jest.fn() };
    requireAuthenticatedUser.mockReturnValue({ ok: true, user: { username: "ash" } });
    createSlug.mockReturnValue("pokemon");

    const notFoundErr = new Error("Not Found");
    notFoundErr.code = 404;
    franchisesContainer.item.mockReturnValue({ read: jest.fn().mockRejectedValue(notFoundErr) });

    franchisesContainer.items.create.mockResolvedValue({ resource: { id: "pokemon", name: "Pokemon", createdBy: "brock" } });

    const res = await handler(request, context);
    expect(res.status).toBe(201);
    expect(res.jsonBody.success).toBe(true);
  });

  it("should return 500 on server error", async () => {
    const request = { json: jest.fn().mockResolvedValue({ franchiseName: "Pokemon" }) };
    const context = { log: jest.fn() };
    requireAuthenticatedUser.mockReturnValue({ ok: true, user: { username: "ash" } });
    createSlug.mockReturnValue("pokemon");

    franchisesContainer.item.mockImplementation(() => { throw new Error("DB Crash"); });
    const res = await handler(request, context);
    expect(res.status).toBe(500);
  });
});
