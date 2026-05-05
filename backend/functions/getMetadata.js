// ============================================================
// INST347 - Get Metadata
// GET /api/getMetadata
// ============================================================

const { app } = require("@azure/functions");
const { franchisesContainer } = require("./db");
const { getAllTcgapiFranchiseSchemas, getSupportedTcgapiFranchises } = require("./tcgapiUtils");

app.http("getMetadata", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // 1. Get all active franchises to populate the "Add Card" dropdown
      const { resources: franchisesFromDb } = await franchisesContainer.items
        .query("SELECT c.id, c.name FROM c ORDER BY c.name ASC")
        .fetchAll();

      const franchiseMap = new Map();
      for (const franchise of getSupportedTcgapiFranchises()) {
        franchiseMap.set(franchise.id, { id: franchise.id, name: franchise.name });
      }
      for (const franchise of franchisesFromDb) {
        franchiseMap.set(franchise.id, { id: franchise.id, name: franchise.name });
      }

      const franchises = [...franchiseMap.values()].sort((a, b) => a.name.localeCompare(b.name));
      const franchiseSchemaPayload = await getAllTcgapiFranchiseSchemas();

      return {
        status: 200,
        jsonBody: {
          success: true,
          franchises,
          franchiseCardSchemas: franchiseSchemaPayload.schemas,
          franchiseCardSchemasGeneratedAt: franchiseSchemaPayload.generatedAt,
          franchiseCardSchemasSampleLimit: franchiseSchemaPayload.sampleLimit,
        },
      };
    } catch (error) {
      return { status: 500, jsonBody: { error: "Server error: " + error.message } };
    }
  },
});
