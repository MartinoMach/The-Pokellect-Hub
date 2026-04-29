const { app } = require("@azure/functions");
const { authorizeUsername } = require("./auth");
const { uploadImageFromUrl } = require("./blobUtils");

const toSlug = (value, fallback) => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

app.http("uploadCardImage", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { imageUrl, username, cardName, franchiseId, filePrefix } = body;

      // Optional: You can uncomment the below lines to enforce authentication later
      // const auth = authenticateRequest(request, { required: true });
      // if (!auth.ok) return auth.response;

      if (!imageUrl) {
        return { status: 400, jsonBody: { success: false, error: "imageUrl is required." } };
      }

      if (username) {
        const auth = authorizeUsername(request, username);
        if (!auth.ok) return auth.response;
      }

      const prefixParts = [
        "cards",
        toSlug(franchiseId, "custom"),
        toSlug(username, "anonymous"),
        toSlug(cardName, "image"),
      ];

      const uploaded = await uploadImageFromUrl(imageUrl, { filePrefix: filePrefix || prefixParts.join("/") });

      return {
        status: 200,
        jsonBody: {
          success: true,
          blobName: uploaded.blobName,
          storageImageUrl: uploaded.url,
          sourceImageUrl: imageUrl,
          imageUrl: uploaded.readUrl || uploaded.url,
        },
      };
    } catch (error) {
      context.log("uploadCardImage error:", error.message);
      return { status: 500, jsonBody: { success: false, error: error.message } };
    }
  },
});
