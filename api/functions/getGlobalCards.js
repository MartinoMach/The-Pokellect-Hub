// ============================================================
// INST347 - Get Global Cards
// GET /api/getGlobalCards?franchise=pokemon-tcg&search=charizard
// ============================================================

const { app } = require("@azure/functions");
const { cardsContainer } = require("./db");
// const { ensureFreshPrice } = require("./ebayUtils");
const { withDisplayImageUrl } = require("./blobUtils");

app.http("getGlobalCards", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const franchiseId = request.query.get("franchise");
      const searchQuery = request.query.get("search");
      const limitParam = request.query.get("limit");
      const requestedLimit = limitParam ? Number(limitParam) : NaN;
      const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50;

      let queryStr = `SELECT TOP ${limit} * FROM c WHERE 1=1`;
      const parameters = [];

      // Filter by Franchise if provided
      if (franchiseId) {
        queryStr += " AND c.franchiseId = @franchiseId";
        parameters.push({ name: "@franchiseId", value: franchiseId });
      }

      // Filter by Name if provided (using NoSQL CONTAINS for partial matching)
      if (searchQuery) {
        queryStr += " AND CONTAINS(LOWER(c.name), @search)";
        parameters.push({ name: "@search", value: searchQuery.toLowerCase() });
      }

      queryStr += " ORDER BY c.createdAt DESC";
      const { resources: cards } = await cardsContainer.items.query({ query: queryStr, parameters }).fetchAll();

      // Price freshness checks disabled - returning raw DB payload
      const updatedCards = await Promise.all(cards.map((card) => withDisplayImageUrl(card)));

      // Return the updated array
      return {
        status: 200,
        jsonBody: { success: true, count: updatedCards.length, cards: updatedCards },
      };

    } catch (error) {
      context.log("GetGlobalCards error:", error.message);
      return { status: 500, jsonBody: { error: "Server error: " + error.message } };
    }
  },
});
