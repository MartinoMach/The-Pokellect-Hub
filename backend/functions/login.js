// ============================================================
// INST347 - Login Function
// POST /api/login
// Body: { "username": "alice", "password": "mypass123" }
//
// SECURITY: This function uses bcrypt.compare() to check the password.
// We NEVER compare plaintext strings — we compare the password
// against the stored hash.
// ============================================================

const { app } = require("@azure/functions");
const bcrypt = require("bcryptjs");
const { usersContainer } = require("./db");
const { issueAuthToken } = require("./auth");

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const username = body?.username?.trim();
      const password = body?.password;

      if (!username || !password) {
        return {
          status: 400,
          jsonBody: { success: false, error: "Username and password are required" },
        };
      }

      // Find user by username
      const { resources: users } = await usersContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.username = @username",
          parameters: [{ name: "@username", value: username.toLowerCase() }],
        })
        .fetchAll();

      if (users.length === 0) {
        return {
          status: 401,
          jsonBody: { success: false, error: "Invalid username or password" },
        };
      }

      const user = users[0];

      // Compare the plaintext password against the stored hash
      // bcrypt.compare() returns true if they match, false if they don't
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return {
          status: 401,
          jsonBody: { success: false, error: "Invalid username or password" },
        };
      }

      // Return user info (NEVER send password or hash back)
      return {
        status: 200,
        jsonBody: {
          success: true,
          token: issueAuthToken(user),
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            binderIsPrivate: user.binderIsPrivate || false, // PRIVACY SETTING PASSED TO FRONTEND
            createdAt: user.createdAt,
          },
        },
      };
    } catch (error) {
      context.log("Login error:", error.message);
      return {
        status: 500,
        jsonBody: { success: false, error: "Server error: " + error.message },
      };
    }
  },
});
