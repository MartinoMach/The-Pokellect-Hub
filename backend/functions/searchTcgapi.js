const { app } = require("@azure/functions");
const { getTcgapiCardsPage, resolveTcgapiImageUrl, getTcgapiCardById } = require("./tcgapiUtils");

// Simple in-memory rate limiter configuration
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 15; // Increased to prevent blocking normal search typing

app.http("searchTcgapi", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      // --- Rate Limiting Logic ---
      // Prevent memory leaks by periodically clearing the map if it gets too large
      if (rateLimitMap.size > 1000) rateLimitMap.clear();

      // Extract client IP (Azure Functions uses x-forwarded-for to track the original caller IP)
      const clientIp = request.headers.get("x-forwarded-for") || "unknown_client";
      const now = Date.now();
      const rateData = rateLimitMap.get(clientIp) || { count: 0, startTime: now };

      if (now - rateData.startTime > RATE_LIMIT_WINDOW_MS) {
        // Window expired, reset counter
        rateData.count = 1;
        rateData.startTime = now;
      } else {
        rateData.count++;
        if (rateData.count > MAX_REQUESTS_PER_WINDOW) {
          context.log(`Rate limit exceeded for IP: ${clientIp}`);
          return {
            status: 429, // 429 Too Many Requests
            jsonBody: { success: false, error: "Too many requests. Please slow down and try again in a few seconds." },
          };
        }
      }
      rateLimitMap.set(clientIp, rateData);
      // ---------------------------

      const franchiseId = request.query.get("franchiseId");
      const q = request.query.get("q");

      if (!franchiseId || !q) {
        return {
          status: 400,
          jsonBody: { success: false, error: "franchiseId and query (q) are required" },
        };
      }

      // Attempt to fetch by exact Card ID first (e.g. OP06-014)
      let rawCards = [];
      try {
        const exactCard = await getTcgapiCardById(franchiseId, q);
        if (exactCard) {
          rawCards = [exactCard];
        }
      } catch (idErr) {
        // Fallback: If not an exact ID (e.g. user is still typing), search by name for typeahead
        try {
          const response = await getTcgapiCardsPage(franchiseId, { name: q, limit: 15 });
          rawCards = response.data || [];
        } catch (searchErr) {
          context.log("Fallback search failed:", searchErr.message);
        }
      }

      // Map the raw API cards to a simple, consistent format for the frontend search results.
      // This object should contain only what's needed for display and for the subsequent import call.
      const mappedCards = rawCards
        .map((card) => {
          if (!card || typeof card !== "object") return null;

          // The frontend needs the original card ID to import it.
          const sourceCardId = String(card.id || card.code || card.cardId || card.uuid || card.number || "").trim();
          if (!sourceCardId) {
            context.log(`Skipping card during search due to missing ID: ${card.name || "(unknown name)"}`);
            return null;
          }

          return {
            id: sourceCardId, // This is the ID the import function expects.
            name: card.name || "Unknown Card",
            imageUrl: resolveTcgapiImageUrl(card),
            setName: card.set?.name || card.setName || null,
          };
        })
        .filter(Boolean); // This removes any null entries from cards that failed to map.

      return {
        status: 200,
        jsonBody: { success: true, cards: mappedCards },
      };
    } catch (error) {
      context.log("Search API error:", error.message);
      return {
        status: 500,
        jsonBody: { success: false, error: "Failed to search external API." },
      };
    }
  },
});
