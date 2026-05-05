const { app } = require("@azure/functions");
const { usersContainer, messagesContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  usersContainer: {
    items: { query: jest.fn() },
  },
  messagesContainer: {
    items: { create: jest.fn() },
  },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));

describe("sendMessage API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/sendMessage");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reject messages when the token user does not match the sender", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ currentUsername: "ash", targetUsername: "misty", text: "hi" }),
    };
    const context = { log: jest.fn() };

    authorizeUsername.mockReturnValue({
      ok: false,
      response: { status: 403, jsonBody: { error: "Forbidden" } },
    });

    const res = await handler(request, context);

    expect(authorizeUsername).toHaveBeenCalledWith(request, "ash");
    expect(res.status).toBe(403);
    expect(messagesContainer.items.create).not.toHaveBeenCalled();
  });

  it("should save a message for accepted friends", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ currentUsername: "ASH", targetUsername: "Misty", text: "  hello!  " }),
    };
    const context = { log: jest.fn() };
    const currentUser = { id: "user_ash", username: "ash", friends: ["misty"] };
    const targetUser = { id: "user_misty", username: "misty", friends: ["ash"] };

    authorizeUsername.mockReturnValue({ ok: true, user: { username: "ash" } });
    usersContainer.items.query
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [currentUser] }) })
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [targetUser] }) });
    messagesContainer.items.create.mockResolvedValue({});

    const res = await handler(request, context);

    expect(res.status).toBe(201);
    expect(messagesContainer.items.create).toHaveBeenCalledWith(expect.objectContaining({
      threadId: "ash__misty",
      sender: "ash",
      recipient: "misty",
      text: "hello!",
    }));
    expect(res.jsonBody.message.text).toBe("hello!");
  });

  it("should reject messages to users who are not accepted friends", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ currentUsername: "ash", targetUsername: "misty", text: "hi" }),
    };
    const context = { log: jest.fn() };
    const currentUser = { id: "user_ash", username: "ash", friends: [] };
    const targetUser = { id: "user_misty", username: "misty", friends: [] };

    authorizeUsername.mockReturnValue({ ok: true, user: { username: "ash" } });
    usersContainer.items.query
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [currentUser] }) })
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [targetUser] }) });

    const res = await handler(request, context);

    expect(res.status).toBe(403);
    expect(messagesContainer.items.create).not.toHaveBeenCalled();
  });
});
