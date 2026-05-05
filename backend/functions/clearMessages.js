const { app } = require("@azure/functions");
const { usersContainer } = require("./db");
const { authorizeUsername } = require("./auth");
const { loadFriendPair, normalizeUsername } = require("./messageUtils");

app.http("clearMessages", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const currentUsername = normalizeUsername(body.currentUsername);
      const targetUsername = normalizeUsername(body.targetUsername);

      if (!currentUsername || !targetUsername) {
        return { status: 400, jsonBody: { success: false, error: "Both usernames are required." } };
      }

      const auth = authorizeUsername(request, currentUsername);
      if (!auth.ok) return auth.response;

      const pair = await loadFriendPair(usersContainer, currentUsername, targetUsername);
      if (pair.error) return pair.error;

      pair.currentUser.chatClears = pair.currentUser.chatClears || {};
      pair.currentUser.chatClears[pair.threadId] = new Date().toISOString();

      await usersContainer.item(pair.currentUser.id, pair.currentUser.id).replace(pair.currentUser);

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      context.log("Error in clearMessages:", error);
      return { status: 500, jsonBody: { success: false, error: "Internal server error." } };
    }
  },
});
