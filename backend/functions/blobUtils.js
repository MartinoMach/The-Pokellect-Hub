const path = require("path");
const axios = require("axios");
const { BlobServiceClient, BlobSASPermissions, SASProtocol } = require("@azure/storage-blob");

const DEFAULT_BLOB_CONTAINER_NAME = "card-images";
const IMAGE_CONTENT_TYPE_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const getStorageConnectionString = () =>
  process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING ||
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  process.env.AzureWebJobsStorage;

const getBlobContainerName = () => process.env.BLOB_CONTAINER_NAME || DEFAULT_BLOB_CONTAINER_NAME;
const getBlobReadSasTtlMinutes = () => {
  const rawValue = Number(process.env.BLOB_READ_SAS_TTL_MINUTES);
  if (!Number.isFinite(rawValue)) return 60;
  return Math.max(1, Math.min(24 * 60, Math.floor(rawValue)));
};

const getBlobServiceClient = () => {
  const connectionString = getStorageConnectionString();
  if (!connectionString) {
    throw new Error(
      "Missing Azure Storage connection string. Set AZURE_BLOB_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONNECTION_STRING, or AzureWebJobsStorage.",
    );
  }
  return BlobServiceClient.fromConnectionString(connectionString);
};

const normalizeContentType = (contentType) =>
  String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

const inferExtension = (contentType) => IMAGE_CONTENT_TYPE_TO_EXTENSION[normalizeContentType(contentType)] || null;

const sanitizePathSegment = (value, fallback = "image") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const normalizeCardImagePrefix = (filePrefix = "cards/image") => {
  const segments = String(filePrefix || "")
    .split("/")
    .map((segment) => sanitizePathSegment(segment, ""))
    .filter(Boolean);

  if (segments.length === 0) {
    return "cards/image";
  }

  if (segments[0] !== "cards") {
    segments.unshift("cards");
  }

  return segments.join("/");
};

const getRecordSourceImageUrl = (record) => {
  if (!record || typeof record !== "object") return null;
  if (typeof record.sourceImageUrl === "string" && record.sourceImageUrl) return record.sourceImageUrl;
  if (typeof record.originalImageUrl === "string" && record.originalImageUrl) return record.originalImageUrl;
  return null;
};

const getRecordBlobName = (record) => {
  if (!record || typeof record !== "object") return null;
  if (typeof record.blobName === "string" && record.blobName) return record.blobName;
  if (typeof record.imageBlobName === "string" && record.imageBlobName) return record.imageBlobName;
  return getBlobNameFromUrl(record.imageUrl);
};

const getBlobNameFromUrl = (blobUrl) => {
  if (!blobUrl || typeof blobUrl !== "string") return null;
  let parsedUrl;
  try {
    parsedUrl = new URL(blobUrl);
  } catch {
    return null;
  }

  const containerPrefix = `/${getBlobContainerName()}/`;
  if (!parsedUrl.pathname.toLowerCase().startsWith(containerPrefix.toLowerCase())) {
    return null;
  }

  const blobName = decodeURIComponent(parsedUrl.pathname.slice(containerPrefix.length));
  return blobName || null;
};

const getSignedBlobReadUrl = async (blobName, options = {}) => {
  if (!blobName || typeof blobName !== "string") return null;

  const ttlMinutes = Number.isFinite(options.ttlMinutes)
    ? Math.max(1, Math.min(24 * 60, Math.floor(options.ttlMinutes)))
    : getBlobReadSasTtlMinutes();

  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(getBlobContainerName());
  const blobClient = containerClient.getBlobClient(blobName);

  try {
    return await blobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse("r"),
      protocol: SASProtocol.Https,
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn: new Date(Date.now() + ttlMinutes * 60 * 1000),
    });
  } catch {
    // Fallback: when the configured credential cannot sign SAS (for example, SAS-only connection strings).
    return blobClient.url;
  }
};

const toDisplayImageUrl = async (imageUrl, options = {}) => {
  if (!imageUrl || typeof imageUrl !== "string") return imageUrl || null;

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return imageUrl;
  }

  if (parsedUrl.searchParams.has("sig")) {
    return imageUrl;
  }

  const blobName = getBlobNameFromUrl(imageUrl);
  if (!blobName) {
    return imageUrl;
  }

  const signedUrl = await getSignedBlobReadUrl(blobName, options);
  return signedUrl || imageUrl;
};

const withDisplayImageUrl = async (record, options = {}) => {
  if (!record || typeof record !== "object") {
    return record;
  }

  const blobName = getRecordBlobName(record);
  const sourceImageUrl = getRecordSourceImageUrl(record);
  let displayImageUrl = null;

  if (blobName) {
    displayImageUrl = await getSignedBlobReadUrl(blobName, options);
  }

  if (!displayImageUrl && record.imageUrl) {
    displayImageUrl = await toDisplayImageUrl(record.imageUrl, options);
  }

  if (!displayImageUrl && sourceImageUrl) {
    displayImageUrl = sourceImageUrl;
  }

  return {
    ...record,
    blobName: blobName || null,
    sourceImageUrl: sourceImageUrl || null,
    imageUrl: displayImageUrl || null,
  };
};

const uploadImageBuffer = async ({ buffer, contentType, filePrefix = "cards" }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("A non-empty image buffer is required.");
  }

  const normalizedContentType = normalizeContentType(contentType);
  if (!normalizedContentType.startsWith("image/")) {
    throw new Error("Only image uploads are allowed in the card-images container.");
  }

  const extension = inferExtension(normalizedContentType);
  if (!extension) {
    throw new Error(
      `Unsupported image content type '${normalizedContentType}'. Allowed types: ${Object.keys(IMAGE_CONTENT_TYPE_TO_EXTENSION).join(", ")}.`,
    );
  }

  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(getBlobContainerName());
  // Keep the container private by default so uploads work even when
  // account-level public blob access is disabled.
  await containerClient.createIfNotExists();

  const normalizedPrefix = normalizeCardImagePrefix(filePrefix);
  const blobName = `${normalizedPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: normalizedContentType },
  });

  const readUrl = await getSignedBlobReadUrl(blobName);
  return {
    blobName,
    url: blockBlobClient.url,
    readUrl,
  };
};

const uploadImageFromUrl = async (imageUrl, options = {}) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("imageUrl is required.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("imageUrl must be a valid URL.");
  }

  const response = await axios.get(parsedUrl.toString(), {
    responseType: "arraybuffer",
    timeout: 15000,
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 10 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
      Accept: "image/webp, image/png, image/jpeg, image/*",
    },
  });

  const contentType = normalizeContentType(response.headers["content-type"] || "");
  if (!contentType.startsWith("image/")) {
    throw new Error(`Remote URL did not return an image content type. Received '${contentType || "unknown"}'.`);
  }

  const baseName = sanitizePathSegment(path.basename(parsedUrl.pathname).replace(/\.[^.]+$/, ""), "image");
  const filePrefix = options.filePrefix || `cards/${baseName || "image"}`;

  return uploadImageBuffer({
    buffer: Buffer.from(response.data),
    contentType,
    filePrefix,
  });
};

module.exports = {
  getSignedBlobReadUrl,
  getBlobNameFromUrl,
  getRecordBlobName,
  getRecordSourceImageUrl,
  normalizeCardImagePrefix,
  toDisplayImageUrl,
  uploadImageFromUrl,
  uploadImageBuffer,
  withDisplayImageUrl,
};
