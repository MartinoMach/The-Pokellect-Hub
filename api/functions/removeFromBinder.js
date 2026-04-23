// ============================================================
// INST347 - Remove From Binder
// DELETE /api/removeFromBinder?binderId=...&username=...
// ============================================================

const { app } = require("@azure/functions");
const { bindersContainer } = require("./db");
const { authorizeUsername } = require("./auth");

app.http("removeFromBinder", {
  methods: ["DELETE"],
  authLevel: "anonymous", // Will be secured by Auth later
  handler: async (request, context) => {
    try {
      const binderId = request.query.get("binderId");
      const username = request.query.get("username");

      if (!binderId || !username) {
        return { status: 400, jsonBody: { error: "binderId and username parameters are required." } };
      }

      const auth = authorizeUsername(request, username.toLowerCase());
      if (!auth.ok) return auth.response;

      // Delete the item from Cosmos DB.
      // In Cosmos DB, you must provide both the item ID and its Partition Key to delete it.
      // We assume 'owner' (username) is the partition key for the Binders container.
      try {
        await bindersContainer.item(binderId, username.toLowerCase()).delete();
      } catch (error) {
        const status = error?.code || error?.statusCode;
        if (status === 404) {
          return { status: 404, jsonBody: { error: "Binder entry not found." } };
        }
        throw error;
      }

      return { 
          status: 200, 
          jsonBody: { success: true, message: "Card successfully removed from your binder." } 
      };
    } catch (error) {
      context.log("RemoveFromBinder error:", error.message);
      return { status: 500, jsonBody: { error: "Failed to remove card: " + error.message } };
    }
  }
});
