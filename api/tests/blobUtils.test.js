const axios = require("axios");
const { BlobServiceClient } = require("@azure/storage-blob");
const {
  getSignedBlobReadUrl,
  getBlobNameFromUrl,
  normalizeCardImagePrefix,
  toDisplayImageUrl,
  uploadImageBuffer,
  uploadImageFromUrl,
  withDisplayImageUrl,
} = require("../functions/blobUtils");

// Mock dependencies
jest.mock("axios");

const mockGenerateSasUrl = jest.fn();
const mockUploadData = jest.fn();
const mockCreateIfNotExists = jest.fn();

jest.mock("@azure/storage-blob", () => {
  const actual = jest.requireActual("@azure/storage-blob");
  return {
    ...actual,
    BlobServiceClient: {
      fromConnectionString: jest.fn(() => ({
        getContainerClient: jest.fn(() => ({
          createIfNotExists: mockCreateIfNotExists,
          getBlobClient: jest.fn(() => ({
            generateSasUrl: mockGenerateSasUrl,
            url: "https://mockstorage.blob.core.windows.net/card-images/mock-blob.png",
          })),
          getBlockBlobClient: jest.fn(() => ({
            uploadData: mockUploadData,
            url: "https://mockstorage.blob.core.windows.net/card-images/mock-blob.png",
          })),
        })),
      })),
    },
  };
});

describe("Blob Utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, AZURE_BLOB_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Configuration", () => {
    it("should throw if connection string is missing", async () => {
      delete process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING;
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;
      delete process.env.AzureWebJobsStorage;
      await expect(getSignedBlobReadUrl("test")).rejects.toThrow("Missing Azure Storage connection string");
    });
  });

  describe("normalizeCardImagePrefix", () => {
    it("should correctly format path prefixes", () => {
      expect(normalizeCardImagePrefix("custom/path/")).toBe("cards/custom/path");
      expect(normalizeCardImagePrefix("cards/pokemon")).toBe("cards/pokemon");
      expect(normalizeCardImagePrefix("")).toBe("cards/image");
    });
  });

  describe("getBlobNameFromUrl", () => {
    it("should extract blob name from a valid container url", () => {
      const url = "https://mystorage.blob.core.windows.net/card-images/cards/pokemon/pika.png";
      expect(getBlobNameFromUrl(url)).toBe("cards/pokemon/pika.png");
    });

    it("should return null for invalid urls or non-matching containers", () => {
      expect(getBlobNameFromUrl("not-a-url")).toBeNull();
      expect(getBlobNameFromUrl("https://mystorage.blob.core.windows.net/wrong-container/pika.png")).toBeNull();
    });
  });

  describe("getSignedBlobReadUrl", () => {
    it("should return a signed sas url", async () => {
      mockGenerateSasUrl.mockResolvedValue("https://mock.sas.url/pika.png?sig=123");
      const url = await getSignedBlobReadUrl("cards/pokemon/pika.png");
      expect(url).toBe("https://mock.sas.url/pika.png?sig=123");
    });

    it("should fallback to raw url if sas generation fails", async () => {
      mockGenerateSasUrl.mockRejectedValue(new Error("SAS Error"));
      const url = await getSignedBlobReadUrl("cards/pokemon/pika.png");
      expect(url).toBe("https://mockstorage.blob.core.windows.net/card-images/mock-blob.png");
    });
  });

  describe("toDisplayImageUrl", () => {
    it("should return raw url if not a valid url", async () => {
      expect(await toDisplayImageUrl("not-a-url")).toBe("not-a-url");
    });

    it("should return raw url if it already has a sig", async () => {
      expect(await toDisplayImageUrl("https://url.com/img.png?sig=123")).toBe("https://url.com/img.png?sig=123");
    });

    it("should return raw url if no blobname matched", async () => {
      expect(await toDisplayImageUrl("https://external.com/img.png")).toBe("https://external.com/img.png");
    });

    it("should return signed url if blobName matches", async () => {
      mockGenerateSasUrl.mockResolvedValue("https://mock.sas/img.png?sig=456");
      const res = await toDisplayImageUrl("https://mystorage.blob.core.windows.net/card-images/img.png");
      expect(res).toBe("https://mock.sas/img.png?sig=456");
    });
  });

  describe("withDisplayImageUrl", () => {
    it("should hydrate a record with a SAS url if blobName exists", async () => {
      mockGenerateSasUrl.mockResolvedValue("https://mock.sas.url/pika.png?sig=123");
      const record = { id: "123", blobName: "cards/pokemon/pika.png", imageUrl: "raw_url" };
      
      const hydrated = await withDisplayImageUrl(record);
      expect(hydrated.imageUrl).toBe("https://mock.sas.url/pika.png?sig=123");
      expect(hydrated.blobName).toBe("cards/pokemon/pika.png");
    });

    it("should return the record unchanged if no image info exists", async () => {
      const record = { id: "123" };
      const hydrated = await withDisplayImageUrl(record);
      expect(hydrated.imageUrl).toBeNull();
    });

    it("should fallback to imageUrl if it can be resolved", async () => {
      mockGenerateSasUrl.mockResolvedValue("https://mock.sas.url/img.png?sig=123");
      const record = { id: "123", imageUrl: "https://mystorage.blob.core.windows.net/card-images/img.png" };
      const hydrated = await withDisplayImageUrl(record);
      expect(hydrated.imageUrl).toBe("https://mock.sas.url/img.png?sig=123");
    });

    it("should fallback to sourceImageUrl if no blobName or valid imageUrl exists", async () => {
      const record = { id: "123", sourceImageUrl: "https://example.com/source.png" };
      const hydrated = await withDisplayImageUrl(record);
      expect(hydrated.imageUrl).toBe("https://example.com/source.png");
    });
  });

  describe("uploadImageBuffer", () => {
    it("should throw if buffer is empty or invalid", async () => {
      await expect(uploadImageBuffer({ buffer: null })).rejects.toThrow("A non-empty image buffer is required.");
      await expect(uploadImageBuffer({ buffer: Buffer.from("") })).rejects.toThrow("A non-empty image buffer is required.");
    });

    it("should throw if content type is not image", async () => {
      await expect(uploadImageBuffer({ buffer: Buffer.from("data"), contentType: "text/plain" })).rejects.toThrow("Only image uploads are allowed");
    });

    it("should throw if extension is unsupported", async () => {
      await expect(uploadImageBuffer({ buffer: Buffer.from("data"), contentType: "image/svg+xml" })).rejects.toThrow("Unsupported image content type");
    });

    it("should successfully upload and return urls", async () => {
      mockGenerateSasUrl.mockResolvedValue("https://mock.sas/read-url");
      const res = await uploadImageBuffer({ buffer: Buffer.from("data"), contentType: "image/png" });
      expect(res.blobName).toContain("cards/");
      expect(res.url).toBe("https://mockstorage.blob.core.windows.net/card-images/mock-blob.png");
      expect(res.readUrl).toBe("https://mock.sas/read-url");
      expect(mockCreateIfNotExists).toHaveBeenCalled();
      expect(mockUploadData).toHaveBeenCalled();
    });
  });

  describe("uploadImageFromUrl", () => {
    it("should throw if imageUrl is missing or invalid", async () => {
      await expect(uploadImageFromUrl()).rejects.toThrow("imageUrl is required.");
      await expect(uploadImageFromUrl("not-a-url")).rejects.toThrow("imageUrl must be a valid URL.");
    });

    it("should throw an error if the remote url does not return an image", async () => {
      axios.get.mockResolvedValue({
        data: Buffer.from("<html></html>"),
        headers: { "content-type": "text/html" }
      });
      await expect(uploadImageFromUrl("https://example.com/index.html")).rejects.toThrow("did not return an image content type");
    });

    it("should successfully download and upload an image", async () => {
      axios.get.mockResolvedValue({
        data: Buffer.from("imagedata"),
        headers: { "content-type": "image/jpeg" }
      });
      mockGenerateSasUrl.mockResolvedValue("https://mock.sas/read");
      
      const res = await uploadImageFromUrl("https://example.com/pika.jpg");
      
      expect(axios.get).toHaveBeenCalled();
      expect(res.blobName).toContain("pika");
      expect(res.url).toBe("https://mockstorage.blob.core.windows.net/card-images/mock-blob.png");
    });
  });
});