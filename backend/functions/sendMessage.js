const { app } = require("@azure/functions");
const { usersContainer, messagesContainer } = require("./db");
const { authorizeUsername } = require("./auth");
const { loadFriendPair, normalizeUsername } = require("./messageUtils");

const MAX_MESSAGE_LENGTH = 2000;

app.http("sendMessage", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const currentUsername = normalizeUsername(body.currentUsername);
      const targetUsername = normalizeUsername(body.targetUsername);
      const text = String(body.text || "").trim();

      if (!currentUsername || !targetUsername || !text) {
        return { status: 400, jsonBody: { success: false, error: "Sender, recipient, and message text are required." } };
      }

      if (text.length > MAX_MESSAGE_LENGTH) {
        return { status: 400, jsonBody: { success: false, error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` } };
      }

      const auth = authorizeUsername(request, currentUsername);
      if (!auth.ok) return auth.response;

      const pair = await loadFriendPair(usersContainer, currentUsername, targetUsername);
      if (pair.error) return pair.error;

      const timestamp = new Date().toISOString();
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        partitionKey: pair.threadId, // Safeguard in case your container uses /partitionKey
        threadId: pair.threadId,
        sender: pair.currentUsername,
        recipient: pair.targetUsername,
        text,
        timestamp,
        createdAt: timestamp,
      };

      await messagesContainer.items.create(message);

      return { status: 201, jsonBody: { success: true, message } };
    } catch (error) {
      context.log("Error in sendMessage:", error);
      return { status: 500, jsonBody: { success: false, error: "Internal server error." } };
    }
  },
});
