// ============================================================
// INST347 - Get Profile
// GET /api/getProfile?user=ashketchum
// ============================================================

const { app } = require("@azure/functions");
const { usersContainer, bindersContainer, cardsContainer } = require("./db");
const { authenticateRequest } = require("./auth");

app.http("getProfile", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const targetUser = request.query.get("user");
      const auth = authenticateRequest(request, { required: false });
      if (!auth.ok) return auth.response;

      if (!targetUser) {
        return { status: 400, jsonBody: { error: "User parameter is required" } };
      }

      const normalizedTargetUser = targetUser.toLowerCase();

      // 1. Get Target User Info
      const { resources: users } = await usersContainer.items
        .query({
          query: "SELECT c.id, c.username, c.displayName, c.bio, c.binderIsPrivate, c.createdAt FROM c WHERE c.username = @username",
          parameters: [{ name: "@username", value: normalizedTargetUser }],
        }).fetchAll();

      if (users.length === 0) {
        return { status: 404, jsonBody: { error: "Trainer not found" } };
      }

      const profile = users[0];
      const hydratedBinder = [];
      const isPrivate = profile.binderIsPrivate === true;
      const isOwner = auth.user?.username === normalizedTargetUser;

      // If it's public, OR if the person looking is the owner, fetch the cards
      if (!isPrivate || isOwner) {
        const { resources: collection } = await bindersContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.owner = @owner ORDER BY c.addedAt DESC",
            parameters: [{ name: "@owner", value: normalizedTargetUser }],
          })
          .fetchAll();

        if (collection.length > 0) {
          const globalIds = [...new Set(collection.map((item) => item.globalCardId))];
          const cardLookupSpec = {
            query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@ids, c.id)",
            parameters: [{ name: "@ids", value: globalIds }],
          };
          const { resources: globalCards } = await cardsContainer.items.query(cardLookupSpec).fetchAll();
          const globalCardMap = new Map(globalCards.map((card) => [card.id, card]));

          const hydratedCollection = collection.map((binderEntry) => {
            let masterCard = globalCardMap.get(binderEntry.globalCardId);
            binderEntry.currentPrice = masterCard ? masterCard.currentPrice : null;
            return binderEntry;
          });
          hydratedBinder.push(...hydratedCollection);
        }
      }

      return {
        status: 200,
        jsonBody: {
          success: true,
          user: profile,
          binder: hydratedBinder,
          isBinderHidden: isPrivate && !isOwner,
        },
      };
    } catch (error) {
      return { status: 500, jsonBody: { error: "Server error: " + error.message } };
    }
  },
});
