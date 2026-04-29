const { app } = require("@azure/functions");
const { franchisesContainer } = require("../functions/db");
const { getAllTcgapiFranchiseSchemas, getSupportedTcgapiFranchises } = require("../functions/tcgapiUtils");

// Mock dependencies
jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  franchisesContainer: { items: { query: jest.fn() } },
}));
jest.mock("../functions/tcgapiUtils", () => ({
  getAllTcgapiFranchiseSchemas: jest.fn(),
  getSupportedTcgapiFranchises: jest.fn(),
}));

describe("getMetadata API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/getMetadata");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should merge DB franchises with TCG API franchises and return metadata", async () => {
    const request = {}; // No params needed
    const context = { log: jest.fn() };

    // Mock DB returning a custom franchise
    franchisesContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [{ id: "my-custom-tcg", name: "My Custom TCG" }] }),
    });

    // Mock tcgapiUtils returning a supported franchise
    getSupportedTcgapiFranchises.mockReturnValue([{ id: "pokemon", name: "Pokemon" }]);

    // Mock the schema payload
    const mockSchemaPayload = {
      schemas: [{ franchiseId: "pokemon", status: "ok" }],
      generatedAt: "2026-01-01T00:00:00.000Z",
      sampleLimit: 3,
    };
    getAllTcgapiFranchiseSchemas.mockResolvedValue(mockSchemaPayload);

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(res.jsonBody.success).toBe(true);

    // Verify franchise merging and sorting
    expect(res.jsonBody.franchises).toEqual([
      { id: "my-custom-tcg", name: "My Custom TCG" },
      { id: "pokemon", name: "Pokemon" },
    ]);

    // Verify schema payload is included
    expect(res.jsonBody.franchiseCardSchemas).toEqual(mockSchemaPayload.schemas);
    expect(res.jsonBody.franchiseCardSchemasGeneratedAt).toBe(mockSchemaPayload.generatedAt);
  });

  it("should return 500 on a database error", async () => {
    const request = {};
    const context = { log: jest.fn() };

    franchisesContainer.items.query.mockImplementation(() => { throw new Error("DB Connection Failed"); });

    const res = await handler(request, context);

    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("DB Connection Failed");
  });
});
