const { app } = require("@azure/functions");
const { franchisesContainer } = require("./db");
const { createSlug } = require("./tcgapiUtils");
const { requireAuthenticatedUser } = require("./auth");

app.http("addFranchise", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const auth = requireAuthenticatedUser(request);
      if (!auth.ok) return auth.response;

      const { franchiseName, addedBy } = await request.json();
      const normalizedName = franchiseName?.trim();

      if (!normalizedName) {
        return { status: 400, jsonBody: { error: "Franchise name is required." } };
      }

      const franchiseId = createSlug(normalizedName);
      if (!franchiseId) {
        return { status: 400, jsonBody: { error: "Invalid franchise name." } };
      }

      let existing;
      try {
        const { resource } = await franchisesContainer.item(franchiseId, franchiseId).read();
        existing = resource;
      } catch (error) {
        const status = error?.code || error?.statusCode;
        if (status !== 404) throw error;
      }

      if (existing) {
        return { status: 409, jsonBody: { error: "Franchise already exists!" } };
      }

      const newFranchise = {
        id: franchiseId,
        name: normalizedName,
        createdBy: addedBy?.trim() || auth.user.username,
        createdAt: new Date().toISOString(),
      };

      const { resource } = await franchisesContainer.items.create(newFranchise);
      return { status: 201, jsonBody: { success: true, franchise: resource } };
    } catch (error) {
      return { status: 500, jsonBody: { error: error.message } };
    }
  }
});
