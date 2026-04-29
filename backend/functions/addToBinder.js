const { app } = require("@azure/functions");
const { bindersContainer, cardsContainer } = require("./db");
const { authorizeUsername } = require("./auth");
const { withDisplayImageUrl } = require("./blobUtils");

app.http("addToBinder", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const { username, globalCardId, franchiseId } = await request.json();

      if (!username || !globalCardId || !franchiseId) {
        return { status: 400, jsonBody: { error: "Missing required fields." } };
      }

      const normalizedUsername = username.toLowerCase().trim();
      const auth = authorizeUsername(request, normalizedUsername);
      if (!auth.ok) return auth.response;

      // 1. Verify the global card actually exists
      let globalCard;
      try {
        const { resource } = await cardsContainer.item(globalCardId, franchiseId).read();
        globalCard = resource;
      } catch (error) {
        const status = error?.code || error?.statusCode;
        if (status !== 404) throw error;
      }

      if (!globalCard) {
        return { status: 404, jsonBody: { error: "That card does not exist in the database." } };
      }

      const existingQuery = {
        query: "SELECT TOP 1 c.id FROM c WHERE c.owner = @owner AND c.globalCardId = @globalCardId",
        parameters: [
          { name: "@owner", value: normalizedUsername },
          { name: "@globalCardId", value: globalCardId },
        ],
      };
      const { resources: existing } = await bindersContainer.items.query(existingQuery).fetchAll();
      if (existing.length > 0) {
        return { status: 409, jsonBody: { error: "This card is already in your binder." } };
      }

      // 2. Add to user's binder
      const binderEntry = {
        id: `collection_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        owner: normalizedUsername,
        globalCardId,
        franchiseId,
        cardName: globalCard.name,
        imageUrl: globalCard.imageUrl || null,
        sourceImageUrl: globalCard.sourceImageUrl || null,
        blobName: globalCard.blobName || null,
        addedAt: new Date().toISOString(),
      };

      const { resource } = await bindersContainer.items.create(binderEntry);
      return { status: 201, jsonBody: { success: true, entry: await withDisplayImageUrl(resource) } };
    } catch (error) {
      return { status: 500, jsonBody: { error: error.message } };
    }
  }
});
