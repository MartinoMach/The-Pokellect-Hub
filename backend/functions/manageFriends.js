const { app } = require("@azure/functions");
const { usersContainer } = require("./db");
const { authorizeUsername } = require("./auth");

app.http("manageFriends", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { action, currentUsername, targetUsername } = body;

      if (!currentUsername || !targetUsername || !action) {
        return { status: 400, jsonBody: { error: "Missing parameters." } };
      }

      const normalizedCurrentUsername = currentUsername.toLowerCase().trim();
      const normalizedTargetUsername = targetUsername.toLowerCase().trim();

      if (normalizedCurrentUsername === normalizedTargetUsername) {
        return { status: 400, jsonBody: { error: "You cannot manage friendship with yourself." } };
      }

      const auth = authorizeUsername(request, normalizedCurrentUsername);
      if (!auth.ok) return auth.response;

      // Fetch both users from Cosmos DB
      const { resources: currentUserRes } = await usersContainer.items.query({
        query: "SELECT * FROM c WHERE c.username = @u",
        parameters: [{ name: "@u", value: normalizedCurrentUsername }]
      }).fetchAll();
      
      const { resources: targetUserRes } = await usersContainer.items.query({
        query: "SELECT * FROM c WHERE c.username = @u",
        parameters: [{ name: "@u", value: normalizedTargetUsername }]
      }).fetchAll();

      if (currentUserRes.length === 0 || targetUserRes.length === 0) {
        return { status: 404, jsonBody: { error: "User not found." } };
      }

      const currentUser = currentUserRes[0];
      const targetUser = targetUserRes[0];

      // Initialize arrays if they don't exist yet
      currentUser.friends = currentUser.friends || [];
      currentUser.friendRequests = currentUser.friendRequests || [];
      targetUser.friends = targetUser.friends || [];
      targetUser.friendRequests = targetUser.friendRequests || [];

      if (action === "send") {
        if (!targetUser.friendRequests.includes(normalizedCurrentUsername) && !targetUser.friends.includes(normalizedCurrentUsername)) {
          targetUser.friendRequests.push(normalizedCurrentUsername);
          await usersContainer.item(targetUser.id, targetUser.id).replace(targetUser);
        }
      } else if (action === "accept") {
        currentUser.friendRequests = currentUser.friendRequests.filter(u => u !== normalizedTargetUsername);
        if (!currentUser.friends.includes(normalizedTargetUsername)) currentUser.friends.push(normalizedTargetUsername);
        if (!targetUser.friends.includes(normalizedCurrentUsername)) targetUser.friends.push(normalizedCurrentUsername);
        
        await usersContainer.item(currentUser.id, currentUser.id).replace(currentUser);
        await usersContainer.item(targetUser.id, targetUser.id).replace(targetUser);
      } else if (action === "decline") {
        currentUser.friendRequests = currentUser.friendRequests.filter(u => u !== normalizedTargetUsername);
        await usersContainer.item(currentUser.id, currentUser.id).replace(currentUser);
      } else if (action === "remove") {
        currentUser.friends = currentUser.friends.filter(u => u !== normalizedTargetUsername);
        targetUser.friends = targetUser.friends.filter(u => u !== normalizedCurrentUsername);
        
        await usersContainer.item(currentUser.id, currentUser.id).replace(currentUser);
        await usersContainer.item(targetUser.id, targetUser.id).replace(targetUser);
      } else {
        return { status: 400, jsonBody: { error: "Invalid action." } };
      }

      return { status: 200, jsonBody: { success: true } };
    } catch (error) {
      context.log("Error in manageFriends:", error);
      return { status: 500, jsonBody: { error: "Internal server error." } };
    }
  }
});
