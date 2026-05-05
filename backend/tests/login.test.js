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
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("../functions/auth", () => ({
  issueAuthToken: jest.fn(),
}));

describe("Login API Function", () => {
  let handler;

  beforeAll(() => {
    // Require the function file to trigger app.http registration
    require("../functions/login");

    // Extract the registered handler function
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

  it("should return 401 if user does not exist", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ username: "ashketchum", password: "password123" }),
    };
    const context = { log: jest.fn() };

    // DB returns empty array simulating user not found
    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
    });

    const response = await handler(request, context);

    expect(response.status).toBe(401);
    expect(response.jsonBody.error).toBe("Invalid username or password");
  });

  it("should return 401 if password does not match", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ username: "ashketchum", password: "wrongpassword" }),
    };
    const context = { log: jest.fn() };

    // DB returns a user
    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({
        resources: [{ id: "user_123", username: "ashketchum", password: "hashed_password_123" }],
      }),
    });

    // Mock bcrypt compare to fail
    bcrypt.compare.mockResolvedValue(false);

    const response = await handler(request, context);

    expect(response.status).toBe(401);
    expect(response.jsonBody.error).toBe("Invalid username or password");
    expect(bcrypt.compare).toHaveBeenCalledWith("wrongpassword", "hashed_password_123");
  });

  it("should return 200 and a token on successful login", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ username: "ashketchum", password: "password123" }),
    };
    const context = { log: jest.fn() };

    const mockUser = {
      id: "user_123",
      username: "ashketchum",
      password: "hashed_password_123",
      displayName: "Ash",
      bio: "Gotta catch em all",
      binderIsPrivate: false,
      createdAt: new Date().toISOString(),
    };

    usersContainer.items.query.mockReturnValue({
      fetchAll: jest.fn().mockResolvedValue({ resources: [mockUser] }),
    });

    // Mock bcrypt compare to succeed
    bcrypt.compare.mockResolvedValue(true);
    issueAuthToken.mockReturnValue("valid_mocked_jwt");

    const response = await handler(request, context);

    expect(response.status).toBe(200);
    expect(response.jsonBody.success).toBe(true);
    expect(response.jsonBody.token).toBe("valid_mocked_jwt");
    expect(response.jsonBody.user.username).toBe("ashketchum");

    // Verify that the hashed password is not leaked in the return object
    expect(response.jsonBody.user.password).toBeUndefined();
  });
});
