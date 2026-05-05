const { app } = require("@azure/functions");
const { usersContainer } = require("./db");
const bcrypt = require("bcryptjs"); // Used to safely hash and compare passwords
const { authorizeUsername, issueAuthToken } = require("./auth");

app.http("updateProfile", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { username, newUsername, displayName, bio, binderIsPrivate, currentPassword, newPassword, avatarUrl } = body;

      if (!username) {
        return { status: 400, jsonBody: { error: "Username is required." } };
      }

      const normalizedUsername = username.toLowerCase().trim();
      const normalizedNewUsername = newUsername?.toLowerCase().trim();
      const auth = authorizeUsername(request, normalizedUsername);
      if (!auth.ok) return auth.response;

      // 1. Query the database to find the existing user
      const querySpec = {
        query: "SELECT * FROM c WHERE c.username = @username",
        parameters: [{ name: "@username", value: normalizedUsername }],
      };
      
      const { resources: users } = await usersContainer.items.query(querySpec).fetchAll();
      
      if (users.length === 0) {
        return { status: 404, jsonBody: { error: "User not found." } };
      }

      const user = users[0];
      const updatedUser = { ...user };

      // 2. Update Standard Profile Fields
      if (displayName !== undefined) updatedUser.displayName = displayName.trim();
      if (bio !== undefined) updatedUser.bio = bio;
      if (binderIsPrivate !== undefined) updatedUser.binderIsPrivate = binderIsPrivate;
      if (avatarUrl !== undefined) updatedUser.avatarUrl = avatarUrl;

      // 3. Update Username
      if (normalizedNewUsername && normalizedNewUsername !== normalizedUsername) {
        // Check if the new username is already taken by someone else
        const checkSpec = {
          query: "SELECT * FROM c WHERE c.username = @newUsername",
          parameters: [{ name: "@newUsername", value: normalizedNewUsername }],
        };
        const { resources: existingUsers } = await usersContainer.items.query(checkSpec).fetchAll();
        
        if (existingUsers.length > 0) {
          return { status: 400, jsonBody: { error: "That username is already taken." } };
        }
        updatedUser.username = normalizedNewUsername;
      }

      // 4. Update Password securely
      if (currentPassword && newPassword) {
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return { status: 400, jsonBody: { error: "Incorrect current password." } };
        }
        // Hash the new password before storing it
        updatedUser.password = await bcrypt.hash(newPassword, 10);
      }

      // 5. Replace the old user record with the updated one in Cosmos DB
      const { resource } = await usersContainer.item(user.id, user.id).replace(updatedUser);

      const { password, ...safeUser } = resource || updatedUser;
      const token = auth.user && safeUser.username !== auth.user.username ? issueAuthToken(safeUser) : undefined;
      return { status: 200, jsonBody: { success: true, message: "Profile updated successfully.", user: safeUser, token } };
    } catch (error) {
      context.log("Error in updateProfile:", error);
      return { status: 500, jsonBody: { error: "An internal server error occurred while updating the profile." } };
    }
  },
});
