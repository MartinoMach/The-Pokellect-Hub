// ============================================================
// INST347 - Update Profile
// PATCH /api/updateProfile
// Body: { "username": "ashketchum", "binderIsPrivate": true, "bio": "Pokémon Master!" }
// ============================================================

const { app } = require("@azure/functions");
const { usersContainer } = require("./db");
const { authorizeUsername } = require("./auth");

app.http("updateProfile", {
  methods: ["PATCH", "PUT"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { username, binderIsPrivate, bio, displayName } = body;

      if (!username) {
        return { status: 400, jsonBody: { error: "Username is required." } };
      }

      const auth = authorizeUsername(request, username.toLowerCase());
      if (!auth.ok) return auth.response;

      // 1. Fetch the existing user document
      const { resources: users } = await usersContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.username = @username",
          parameters: [{ name: "@username", value: username.toLowerCase() }],
        }).fetchAll();

      if (users.length === 0) {
        return { status: 404, jsonBody: { error: "User not found." } };
      }

      let userDoc = users[0];

      // 2. Apply the requested updates
      // Only update fields that were actually provided in the request
      if (typeof binderIsPrivate === "boolean") {
          userDoc.binderIsPrivate = binderIsPrivate;
      }
      if (bio !== undefined) userDoc.bio = String(bio);
      if (displayName !== undefined) userDoc.displayName = String(displayName).trim();

      // 3. Save the modified document back to Cosmos DB
      // We use .replace() to overwrite the existing document completely
      const { resource: updatedUser } = await usersContainer
        .item(userDoc.id, userDoc.id) // First id is document id, second is partition key
        .replace(userDoc);

      const safeUser = {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        bio: updatedUser.bio || "",
        binderIsPrivate: updatedUser.binderIsPrivate === true,
        createdAt: updatedUser.createdAt,
      };

      return {
        status: 200,
        jsonBody: { success: true, message: "Profile updated successfully.", user: safeUser },
      };
    } catch (error) {
      context.log("UpdateProfile error:", error.message);
      return { status: 500, jsonBody: { error: "Server error: " + error.message } };
    }
  },
});
