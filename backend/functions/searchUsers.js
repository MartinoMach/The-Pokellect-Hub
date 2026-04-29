const { app } = require("@azure/functions");
const { usersContainer } = require("./db");
const { authenticateRequest } = require("./auth");

app.http("searchUsers", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const q = request.query.get("q") || "";

      // Identify the requesting user so we can exclude them from the results
      const auth = authenticateRequest(request, { required: false });
      const currentUser = auth.user?.username?.toLowerCase() || "";

      let querySpec;
      if (q) {
        // Check if the search term is in username or displayName safely
        querySpec = {
          query: "SELECT TOP 20 c.username, c.displayName FROM c WHERE c.username != @currentUser AND (CONTAINS(LOWER(c.username), LOWER(@q)) OR (IS_DEFINED(c.displayName) AND CONTAINS(LOWER(c.displayName), LOWER(@q))))",
          parameters: [
            { name: "@q", value: q.toLowerCase() },
            { name: "@currentUser", value: currentUser }
          ]
        };
      } else {
        // If no search term, safely return the top 20 users (excluding the current user)
        querySpec = {
          query: "SELECT TOP 20 c.username, c.displayName FROM c WHERE c.username != @currentUser",
          parameters: [{ name: "@currentUser", value: currentUser }]
        };
      }

      const { resources } = await usersContainer.items.query(querySpec).fetchAll();

      return {
        status: 200,
        jsonBody: { success: true, users: resources || [] }
      };
    } catch (error) {
      context.log("Search users error:", error.message);
      return {
        status: 500,
        jsonBody: { success: false, error: "Server error searching users" }
      };
    }
  }
});
