const jwt = require("jsonwebtoken");

const AUTH_MODE = (process.env.AUTH_MODE || "optional").toLowerCase();
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const isAuthRequired = () => AUTH_MODE === "required";

const issueAuthToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const extractBearerToken = (request) => {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim();
};

const authenticateRequest = (request, options = {}) => {
  const requireAuth = options.required === true || (options.required !== false && isAuthRequired());
  const token = extractBearerToken(request);

  if (!token) {
    if (requireAuth) {
      return {
        ok: false,
        response: { status: 401, jsonBody: { success: false, error: "Authentication required. Missing bearer token." } },
      };
    }
    return { ok: true, user: null, token: null };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { ok: true, user: decoded, token };
  } catch (error) {
    return {
      ok: false,
      response: { status: 401, jsonBody: { success: false, error: "Invalid or expired token.", details: error.message } },
    };
  }
};

const requireAuthenticatedUser = (request) => {
  return authenticateRequest(request, { required: true });
};

const authorizeUsername = (request, username, options = {}) => {
  const auth = authenticateRequest(request, { required: options.requireAuth !== false });
  if (!auth.ok) return auth;

  if (auth.user && username && auth.user.username !== String(username).toLowerCase()) {
    return {
      ok: false,
      response: { status: 403, jsonBody: { success: false, error: "Forbidden. You do not have permission to access this resource." } },
    };
  }

  return auth;
};

module.exports = {
  issueAuthToken,
  authenticateRequest,
  requireAuthenticatedUser,
  authorizeUsername,
  isAuthRequired,
};
