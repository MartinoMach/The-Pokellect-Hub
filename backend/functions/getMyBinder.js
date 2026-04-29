// ============================================================
// INST347 - Get My Binder
// GET /api/getMyBinder?username=ashketchum&franchise=pokemon-tcg
// ============================================================

const { app } = require("@azure/functions");
const { bindersContainer, cardsContainer } = require("./db");
const { authorizeUsername } = require("./auth");
const { withDisplayImageUrl } = require("./blobUtils");

app.http("getMyBinder", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const username = request.query.get("username");
      const franchiseFilter = request.query.get("franchise");

      if (!username) {
        return { status: 400, jsonBody: { error: "Username is required." } };
      }

      const normalizedUsername = username.toLowerCase().trim();
      const auth = authorizeUsername(request, normalizedUsername);
      if (!auth.ok) return auth.response;

      const querySpec = {
        query: "SELECT * FROM c WHERE c.owner = @owner ORDER BY c.addedAt DESC",
        parameters: [{ name: "@owner", value: normalizedUsername }],
      };

      if (franchiseFilter) {
        querySpec.query = "SELECT * FROM c WHERE c.owner = @owner AND c.franchiseId = @franchiseId ORDER BY c.addedAt DESC";
        querySpec.parameters.push({ name: "@franchiseId", value: franchiseFilter });
      }

      // 1. Fetch static binder entries
      const { resources: myBinder } = await bindersContainer.items.query(querySpec).fetchAll();

      if (myBinder.length === 0) {
        return { status: 200, jsonBody: { success: true, count: 0, binder: [] } };
      }

      // 2. Hydration: Fetch live master cards
      const globalIds = [...new Set(myBinder.map((item) => item.globalCardId))];
      const cardLookupSpec = {
        query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
        parameters: [{ name: "@ids", value: globalIds }],
      };
      const { resources: globalCards } = await cardsContainer.items.query(cardLookupSpec).fetchAll();
      const globalCardMap = new Map(globalCards.map((card) => [card.id, card]));

      // 3. Stitch static prices into the binder
      const hydratedBinder = myBinder.map((binderEntry) => {
        let masterCard = globalCardMap.get(binderEntry.globalCardId);
        binderEntry.currentPrice = masterCard ? masterCard.currentPrice : null;
        if (masterCard) {
          binderEntry.imageUrl = binderEntry.imageUrl || masterCard.imageUrl || null;
          binderEntry.sourceImageUrl = binderEntry.sourceImageUrl || masterCard.sourceImageUrl || null;
          binderEntry.blobName = binderEntry.blobName || masterCard.blobName || null;
        }
        return binderEntry;
      });
      const hydratedBinderWithDisplayUrls = await Promise.all(
        hydratedBinder.map((binderEntry) => withDisplayImageUrl(binderEntry)),
      );

      return {
        status: 200,
        jsonBody: { success: true, count: hydratedBinderWithDisplayUrls.length, binder: hydratedBinderWithDisplayUrls },
      };
    } catch (error) {
      context.log("GetMyBinder error:", error.message);
      return { status: 500, jsonBody: { error: "Server error: " + error.message } };
    }
  },
});
