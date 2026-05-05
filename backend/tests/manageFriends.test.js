const { app } = require("@azure/functions");
const { usersContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  usersContainer: {
    items: { query: jest.fn() },
    item: jest.fn(),
  },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));

describe("manageFriends API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/manageFriends");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if parameters are missing", async () => {
    const request = { json: jest.fn().mockResolvedValue({ action: "send", currentUsername: "ash" }) };
    const context = { log: jest.fn() };

    const res = await handler(request, context);

    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toBe("Missing parameters.");
  });

  it("should reject friend actions for a username that does not match the token", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ action: "send", currentUsername: "ash", targetUsername: "misty" }),
    };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({
      ok: false,
      response: { status: 403, jsonBody: { error: "Forbidden" } },
    });

    const res = await handler(request, context);

    expect(authorizeUsername).toHaveBeenCalledWith(request, "ash");
    expect(res.status).toBe(403);
    expect(usersContainer.items.query).not.toHaveBeenCalled();
  });

  it("should send a normalized friend request to the target user", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ action: "send", currentUsername: "ASH", targetUsername: "Misty" }),
    };
    const context = { log: jest.fn() };
    const currentUser = { id: "user_ash", username: "ash", friends: [], friendRequests: [] };
    const targetUser = { id: "user_misty", username: "misty", friends: [], friendRequests: [] };
    const replace = jest.fn().mockResolvedValue({});

    authorizeUsername.mockReturnValue({ ok: true, user: { username: "ash" } });
    usersContainer.items.query
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [currentUser] }) })
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [targetUser] }) });
    usersContainer.item.mockReturnValue({ replace });

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(targetUser.friendRequests).toEqual(["ash"]);
    expect(usersContainer.item).toHaveBeenCalledWith("user_misty", "user_misty");
    expect(replace).toHaveBeenCalledWith(targetUser);
  });
});
