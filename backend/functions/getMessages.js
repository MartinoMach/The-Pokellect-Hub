const { app } = require("@azure/functions");
const { usersContainer, messagesContainer } = require("./db");
const { authorizeUsername } = require("./auth");
const { loadFriendPair, normalizeUsername } = require("./messageUtils");

app.http("getMessages", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const currentUsername = normalizeUsername(request.query.get("currentUsername"));
      const targetUsername = normalizeUsername(request.query.get("targetUsername"));

      if (!currentUsername || !targetUsername) {
        return { status: 400, jsonBody: { success: false, error: "Both usernames are required." } };
      }

      const auth = authorizeUsername(request, currentUsername);
      if (!auth.ok) return auth.response;

      const pair = await loadFriendPair(usersContainer, currentUsername, targetUsername);
      if (pair.error) return pair.error;

      const clearTimestamp = pair.currentUser.chatClears?.[pair.threadId] || null;
      const parameters = [{ name: "@threadId", value: pair.threadId }];
      let whereClause = "c.threadId = @threadId";

      if (clearTimestamp) {
        whereClause += " AND c.timestamp > @clearTimestamp";
        parameters.push({ name: "@clearTimestamp", value: clearTimestamp });
      }

      const { resources: messages } = await messagesContainer.items.query({
        query: `SELECT * FROM c WHERE ${whereClause} ORDER BY c.timestamp ASC`,
        parameters,
      }).fetchAll();

      return { status: 200, jsonBody: { success: true, messages } };
    } catch (error) {
      context.log("Error in getMessages:", error);
      return { status: 500, jsonBody: { success: false, error: "Internal server error." } };
    }
  },
});
