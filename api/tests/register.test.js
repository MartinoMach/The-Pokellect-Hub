const { app } = require("@azure/functions");
const bcrypt = require("bcryptjs");
const { usersContainer } = require("../functions/db");
const { issueAuthToken } = require("../functions/auth");

// 1. Mock dependencies
jest.mock("@azure/functions", () => ({
  app: {
    http: jest.fn(),
  },
}));

jest.mock("../functions/db", () => ({
  usersContainer: {
    items: {
      query: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

jest.mock("../functions/auth", () => ({
  issueAuthToken: jest.fn(),
}));

describe("Register API Function", () => {
  let handler;

  beforeAll(() => {
    // Require the function file to trigger app.http registration
    require("../functions/register");
    
    // Extract the registered handler function so we can test it directly
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if username or password is missing", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ username: "ashketchum" }), // missing password
    };
    const context = { log: jest.fn() };

    const response = await handler(request, context);

    expect(response.status).toBe(400);
    expect(response.jsonBody.error).toBe("Username and password are required");
  });

  it("should return 409 if username already taken", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ username: "ashketchum", password: "password123" }),
    };
    const context = { log: jest.fn() };

    // Mock the DB query to return an existing user
    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [{ id: "user_123", username: "ashketchum" }] }),
    });

    const response = await handler(request, context);

    expect(response.status).toBe(409);
    expect(response.jsonBody.error).toBe("Username already taken");
  });

  it("should return 201 and create user successfully", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ username: "ashketchum", password: "password123", displayName: "Ash" }),
    };
    const context = { log: jest.fn() };

    // Mock DB query to return empty (user does not exist)
    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
    });

    bcrypt.hash.mockResolvedValue("hashed_password_123");
    
    // Mock DB create
    usersContainer.items.create.mockResolvedValue({
      resource: {
        id: "user_123",
        username: "ashketchum",
        displayName: "Ash",
        binderIsPrivate: false,
        createdAt: new Date().toISOString(),
      },
    });
    
    issueAuthToken.mockReturnValue("mocked_jwt_token");

    const response = await handler(request, context);

    expect(response.status).toBe(201);
    expect(response.jsonBody.success).toBe(true);
    expect(response.jsonBody.token).toBe("mocked_jwt_token");
    expect(response.jsonBody.user.username).toBe("ashketchum");
    
    // Verify bcrypt was called correctly
    expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
  });
});