const { app } = require("@azure/functions");
const { cardsContainer, bindersContainer, franchisesContainer } = require("./db");
const { authorizeUsername } = require("./auth");
const { getBlobNameFromUrl, uploadImageFromUrl, withDisplayImageUrl } = require("./blobUtils");
const {
  createSlug,
  getSupportedTcgapiFranchises,
  getTcgapiCardById,
  getTcgapiFranchiseName,
  mapTcgapiCardToGlobalCard,
  normalizeTcgapiFranchiseId,
} = require("./tcgapiUtils");

const ensureFranchiseExists = async (franchiseId) => {
  let franchise = null;
  try {
    const { resource } = await franchisesContainer.item(franchiseId, franchiseId).read();
    franchise = resource;
  } catch (error) {
    const status = error?.code || error?.statusCode;
    if (status !== 404) throw error;
  }

  if (franchise) return franchise;

  const newFranchise = {
    id: franchiseId,
    name: getTcgapiFranchiseName(franchiseId),
    createdBy: "system:apitcg",
    createdAt: new Date().toISOString(),
  };

  const { resource } = await franchisesContainer.items.upsert(newFranchise);
  return resource;
};

app.http("importTcgapiCard", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const {
        cardId,
        franchiseId,
        franchise,
        username,
        addToBinder = false,
        uploadImageToBlob = true,
      } = await request.json();

      if (!cardId) {
        return { status: 400, jsonBody: { success: false, error: "cardId is required." } };
      }

      const requestedFranchise = franchiseId || franchise;
      const normalizedFranchiseId = normalizeTcgapiFranchiseId(requestedFranchise);
      if (!normalizedFranchiseId) {
        const supported = getSupportedTcgapiFranchises().map((item) => item.id);
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: "Unsupported franchise. Use one of the supported apitcg franchise ids.",
            supportedFranchises: supported,
          },
        };
      }

      if (username) {
        const auth = authorizeUsername(request, username);
        if (!auth.ok) return auth.response;
      }

      const tcgapiCard = await getTcgapiCardById(normalizedFranchiseId, cardId);
      if (!tcgapiCard || (!tcgapiCard.id && !tcgapiCard.code && !tcgapiCard.name)) {
        return { status: 404, jsonBody: { success: false, error: "Card not found in apitcg." } };
      }

      await ensureFranchiseExists(normalizedFranchiseId);

      const mappedCard = mapTcgapiCardToGlobalCard(tcgapiCard, normalizedFranchiseId);
      const sourceImageUrl = mappedCard.imageUrl || null;

      let existingCard = null;
      try {
        const { resource } = await cardsContainer.item(mappedCard.id, mappedCard.partitionKey).read();
        existingCard = resource;
      } catch (error) {
        const status = error?.code || error?.statusCode;
        if (status !== 404) throw error;
      }

      let resolvedImageUrl = mappedCard.imageUrl || existingCard?.imageUrl || null;
      let resolvedBlobName = existingCard?.blobName || getBlobNameFromUrl(resolvedImageUrl);
      const blobKey =
        createSlug(mappedCard.tcgapiId || mappedCard.cardNumber || mappedCard.name) ||
        createSlug(cardId) ||
        "card";

      if (existingCard?.blobName && !uploadImageToBlob) {
        resolvedBlobName = existingCard.blobName;
        resolvedImageUrl = existingCard.imageUrl || resolvedImageUrl;
      }

      if (uploadImageToBlob && mappedCard.imageUrl) {
        try {
          const uploaded = await uploadImageFromUrl(mappedCard.imageUrl, {
            filePrefix: `cards/${normalizedFranchiseId}/${blobKey}`,
          });
          resolvedImageUrl = uploaded.url;
          resolvedBlobName = uploaded.blobName;
        } catch (uploadError) {
          context.log("apitcg image upload failed; continuing with source URL:", uploadError.message);
        }
      }

      const upsertCard = {
        ...mappedCard,
        imageUrl: resolvedImageUrl,
        sourceImageUrl: sourceImageUrl || existingCard?.sourceImageUrl || null,
        blobName: resolvedBlobName,
        currentPrice: existingCard?.currentPrice ?? mappedCard.currentPrice,
        lastPriceUpdate: existingCard?.lastPriceUpdate ?? mappedCard.lastPriceUpdate,
        interactionCount: existingCard?.interactionCount ?? mappedCard.interactionCount,
        lastInteractedAt: existingCard?.lastInteractedAt ?? mappedCard.lastInteractedAt,
        createdAt: existingCard?.createdAt || mappedCard.createdAt,
      };

      const { resource: savedCard } = await cardsContainer.items.upsert(upsertCard);

      let binderEntry = null;
      if (addToBinder && username) {
        const normalizedUsername = username.toLowerCase().trim();
        const duplicateQuery = {
          query: "SELECT TOP 1 c.id FROM c WHERE c.owner = @owner AND c.globalCardId = @globalCardId",
          parameters: [
            { name: "@owner", value: normalizedUsername },
            { name: "@globalCardId", value: savedCard.id },
          ],
        };
        const { resources: existingBinderEntries } = await bindersContainer.items.query(duplicateQuery).fetchAll();

        if (existingBinderEntries.length === 0) {
          const entry = {
            id: `collection_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            owner: normalizedUsername,
            globalCardId: savedCard.id,
            franchiseId: savedCard.franchiseId,
            cardName: savedCard.name,
            imageUrl: savedCard.imageUrl || null,
            sourceImageUrl: savedCard.sourceImageUrl || null,
            blobName: savedCard.blobName || null,
            addedAt: new Date().toISOString(),
          };
          const { resource } = await bindersContainer.items.create(entry);
          binderEntry = resource;
        }
      }

      return {
        status: existingCard ? 200 : 201,
        jsonBody: {
          success: true,
          source: "apitcg",
          franchiseId: normalizedFranchiseId,
          card: await withDisplayImageUrl(savedCard),
          binderEntry: await withDisplayImageUrl(binderEntry),
          wasExisting: !!existingCard,
        },
      };
    } catch (error) {
      context.log("importTcgapiCard error:", error.message);
      return { status: 500, jsonBody: { success: false, error: error.message } };
    }
  },
});
