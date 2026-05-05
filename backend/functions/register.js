// ============================================================
// INST347 - Register Function
// POST /api/register
// Body: { "username": "alice", "password": "mypass123", "displayName": "Alice" }
//
// SECURITY: This function HASHES the password before storing it.
// The database NEVER sees the plaintext password.
// ============================================================

const { app } = require("@azure/functions");
const bcrypt = require("bcryptjs");
const { usersContainer } = require("./db");
const { issueAuthToken } = require("./auth");

// Number of salt rounds — higher = more secure but slower
// 10 is standard for most applications
const SALT_ROUNDS = 10;

app.http("register", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const username = body?.username?.trim();
      const password = body?.password;
      const displayName = body?.displayName?.trim();

      // Validate input
      if (!username || !password) {
        return {
          status: 400,
          jsonBody: { success: false, error: "Username and password are required" },
        };
      }

      // Check if username already exists
      const { resources: existing } = await usersContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.username = @username",
          parameters: [{ name: "@username", value: username.toLowerCase() }],
        })
        .fetchAll();

      if (existing.length > 0) {
        return {
          status: 409,
          jsonBody: { success: false, error: "Username already taken" },
        };
      }

      // HASH the password before storing
      // bcrypt.hash() generates a random salt and hashes the password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create the user document
      const user = {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        username: username.toLowerCase(),
        password: hashedPassword, // HASHED — not the original password!
        displayName: displayName || username,
        bio: "",
        avatarUrl: "/pp.png",
        binderIsPrivate: false, // DEFAULT PRIVACY SETTING ADDED HERE
        createdAt: new Date().toISOString(),
      };

      const { resource } = await usersContainer.items.create(user);

      // Return success (NEVER send password or hash back to the client)
      return {
        status: 201,
        jsonBody: {
          success: true,
          token: issueAuthToken(resource),
          user: {
            id: resource.id,
            username: resource.username,
            displayName: resource.displayName,
            avatarUrl: resource.avatarUrl,
            binderIsPrivate: resource.binderIsPrivate,
            createdAt: resource.createdAt,
          },
        },
      };
    } catch (error) {
      context.log("Register error:", error.message);
      return {
        status: 500,
        jsonBody: { success: false, error: "Server error: " + error.message },
      };
    }
  },
});
