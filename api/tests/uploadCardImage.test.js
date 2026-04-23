const { app } = require("@azure/functions");
const { authorizeUsername } = require("../functions/auth");
const { uploadImageFromUrl } = require("../functions/blobUtils");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));
jest.mock("../functions/blobUtils", () => ({ uploadImageFromUrl: jest.fn() }));

describe("uploadCardImage API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/uploadCardImage");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if imageUrl is missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({}) };
    const context = { log: jest.fn() };
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("imageUrl is required.");
  });

  it("should return auth error if authorization fails", async () => {
    const request = { json: jest.fn().mockResolvedValue({ imageUrl: "http://img.com", username: "ash" }) };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: false, response: { status: 403, jsonBody: { error: "Forbidden" } } });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(403);
    expect(res.jsonBody.error).toBe("Forbidden");
  });

  it("should return 200 on successful upload with custom filePrefix", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ 
        imageUrl: "http://img.com/pika.png", 
        username: "ash", 
        cardName: "Pikachu", 
        franchiseId: "pokemon",
        filePrefix: "custom/path"
      }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    uploadImageFromUrl.mockResolvedValue({
      blobName: "custom/path/pika.png",
      url: "http://storage.com/custom/path/pika.png",
      readUrl: "http://sas.url/pika.png"
    });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    expect(res.jsonBody.success).toBe(true);
    expect(res.jsonBody.blobName).toBe("custom/path/pika.png");
    expect(res.jsonBody.imageUrl).toBe("http://sas.url/pika.png");
  });

  it("should return 200 and generate dynamic slugified prefix if omitted", async () => {
    const request = { 
      json: jest.fn().mockResolvedValue({ 
        imageUrl: "http://img.com/pika.png", 
        username: "Ash Ketchum", 
        cardName: "Flying Pikachu VMAX", 
        franchiseId: "Pokemon TCG "
      }) 
    };
    const context = { log: jest.fn() };
    authorizeUsername.mockReturnValue({ ok: true });
    
    uploadImageFromUrl.mockResolvedValue({ blobName: "generated", url: "url" });
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(200);
    
    // Verify that the fallback toSlug generated a clean path
    expect(uploadImageFromUrl).toHaveBeenCalledWith("http://img.com/pika.png", { 
      filePrefix: "cards/pokemon-tcg/ash-ketchum/flying-pikachu-vmax" 
    });
  });

  it("should return 500 on server error", async () => {
    const request = { json: jest.fn().mockResolvedValue({ imageUrl: "http://img.com" }) };
    const context = { log: jest.fn() };
    
    uploadImageFromUrl.mockRejectedValue(new Error("Storage offline"));
    
    const res = await handler(request, context);
    
    expect(res.status).toBe(500);
    expect(res.jsonBody.error).toContain("Storage offline");
  });
});