const { app } = require("@azure/functions");
const { cardsContainer, franchisesContainer, bindersContainer } = require("./db");
const { createSlug } = require("./tcgapiUtils");
const { authorizeUsername } = require("./auth");
const { getBlobNameFromUrl, uploadImageFromUrl, withDisplayImageUrl } = require("./blobUtils");

app.http("addGlobalCard", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { name, franchiseName, username, imageUrl, customData, uploadImageToBlob = true } = body;
      const normalizedName = name?.trim();
      const normalizedFranchiseName = franchiseName?.trim();

      if (!normalizedName || !normalizedFranchiseName) {
        return { status: 400, jsonBody: { error: "Card Name and Franchise are required." } };
      }

      const franchiseId = createSlug(normalizedFranchiseName);
      const cardSlug = createSlug(normalizedName);
      if (!franchiseId || !cardSlug) {
        return { status: 400, jsonBody: { error: "Card Name or Franchise contains invalid characters." } };
      }

      const cardId = `${franchiseId}:${cardSlug}`;
      const customCardData = customData && typeof customData === "object" ? customData : {};
      const {
        id: _ignoredId,
        partitionKey: _ignoredPartitionKey,
        franchiseId: _ignoredFranchiseId,
        name: _ignoredName,
        createdAt: _ignoredCreatedAt,
        imageUrl: _ignoredImageUrl,
        sourceImageUrl: _ignoredSourceImageUrl,
        blobName: _ignoredBlobName,
        ...safeCustomData
      } = customCardData;

      if (username) {
        const auth = authorizeUsername(request, username.toLowerCase().trim());
        if (!auth.ok) return auth.response;
      }

      // 1. Check Franchise Exists
      let franchise;
      try {
        const { resource } = await franchisesContainer.item(franchiseId, franchiseId).read();
        franchise = resource;
      } catch (error) {
        const status = error?.code || error?.statusCode;
        if (status !== 404) throw error;
      }

      if (!franchise) {
        return { status: 404, jsonBody: { error: `Franchise '${normalizedFranchiseName}' not found.` } };
      }

      // 2. Prevent Duplicates in the Encyclopedia
      let existingCard;
      try {
        const { resource } = await cardsContainer.item(cardId, franchiseId).read();
        existingCard = resource;
      } catch (error) {
        const status = error?.code || error?.statusCode;
        if (status !== 404) throw error;
      }

      if (existingCard) {
        return { status: 409, jsonBody: { error: "This card already exists in the global database." } };
      }

      let resolvedImageUrl = imageUrl || null;
      let resolvedBlobName = getBlobNameFromUrl(imageUrl);
      const sourceImageUrl = imageUrl || null;
      if (uploadImageToBlob && imageUrl) {
        try {
          const uploaded = await uploadImageFromUrl(imageUrl, {
            filePrefix: `cards/${franchiseId}/${cardSlug}`,
          });
          resolvedImageUrl = uploaded.url;
          resolvedBlobName = uploaded.blobName;
        } catch (uploadError) {
          context.log("Image upload to Blob failed; using original image URL:", uploadError.message);
        }
      }

      // 3. Create the Global Card
      const newGlobalCard = {
        id: cardId,
        partitionKey: franchiseId,
        name: normalizedName,
        franchiseId,
        imageUrl: resolvedImageUrl,
        sourceImageUrl,
        blobName: resolvedBlobName,
        currentPrice: null,
        lastPriceUpdate: null,
        lastInteractedAt: new Date().toISOString(),
        interactionCount: 1,
        createdAt: new Date().toISOString(),
        verified: false,
        ...safeCustomData,
      };

      const { resource: createdCard } = await cardsContainer.items.create(newGlobalCard);

      // 4. AUTO-ADD TO BINDER (If username is provided)
      let binderEntry = null;
      if (username) {
        const normalizedUsername = username.toLowerCase().trim();
        const duplicateQuery = {
          query: "SELECT TOP 1 c.id FROM c WHERE c.owner = @owner AND c.globalCardId = @globalCardId",
          parameters: [
            { name: "@owner", value: normalizedUsername },
            { name: "@globalCardId", value: cardId },
          ],
        };

        const { resources: existingBinderEntries } = await bindersContainer.items.query(duplicateQuery).fetchAll();
        if (existingBinderEntries.length === 0) {
          binderEntry = {
            id: `collection_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            owner: normalizedUsername,
            globalCardId: cardId,
            franchiseId,
            cardName: normalizedName,
            imageUrl: resolvedImageUrl,
            sourceImageUrl,
            blobName: resolvedBlobName,
            addedAt: new Date().toISOString(),
          };
          const { resource: createdEntry } = await bindersContainer.items.create(binderEntry);
          binderEntry = createdEntry;
        }
      }

      return {
        status: 201,
        jsonBody: {
          success: true,
          card: await withDisplayImageUrl(createdCard),
          binderEntry: await withDisplayImageUrl(binderEntry),
        },
      };
    } catch (error) {
      context.log("AddGlobalCard error:", error.message);
      return { status: 500, jsonBody: { error: error.message } };
    }
  },
});
