const { app } = require("@azure/functions");
const { usersContainer, messagesContainer } = require("../functions/db");
const { authorizeUsername } = require("../functions/auth");

jest.mock("@azure/functions", () => ({ app: { http: jest.fn() } }));
jest.mock("../functions/db", () => ({
  usersContainer: {
    items: { query: jest.fn() },
  },
  messagesContainer: {
    items: { query: jest.fn() },
  },
}));
jest.mock("../functions/auth", () => ({ authorizeUsername: jest.fn() }));

describe("getMessages API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/getMessages");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the shared thread for accepted friends", async () => {
    const request = {
      query: new URLSearchParams({ currentUsername: "ash", targetUsername: "misty" }),
    };
    const context = { log: jest.fn() };
    const currentUser = { id: "user_ash", username: "ash", friends: ["misty"] };
    const targetUser = { id: "user_misty", username: "misty", friends: ["ash"] };
    const messages = [{ id: "msg_1", threadId: "ash__misty", sender: "ash", text: "hi" }];

    authorizeUsername.mockReturnValue({ ok: true, user: { username: "ash" } });
    usersContainer.items.query
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [currentUser] }) })
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [targetUser] }) });
    messagesContainer.items.query.mockReturnValueOnce({
      fetchAll: jest.fn().mockResolvedValue({ resources: messages }),
    });

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(res.jsonBody.messages).toEqual(messages);
    expect(messagesContainer.items.query).toHaveBeenCalledWith(expect.objectContaining({
      parameters: [{ name: "@threadId", value: "ash__misty" }],
    }));
  });

  it("should filter messages after the user's clear timestamp", async () => {
    const request = {
      query: new URLSearchParams({ currentUsername: "ash", targetUsername: "misty" }),
    };
    const context = { log: jest.fn() };
    const currentUser = {
      id: "user_ash",
      username: "ash",
      friends: ["misty"],
      chatClears: { ash__misty: "2026-05-04T12:00:00.000Z" },
    };
    const targetUser = { id: "user_misty", username: "misty", friends: ["ash"] };

    authorizeUsername.mockReturnValue({ ok: true, user: { username: "ash" } });
    usersContainer.items.query
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [currentUser] }) })
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [targetUser] }) });
    messagesContainer.items.query.mockReturnValueOnce({
      fetchAll: jest.fn().mockResolvedValue({ resources: [] }),
    });

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(messagesContainer.items.query).toHaveBeenCalledWith(expect.objectContaining({
      parameters: [
        { name: "@threadId", value: "ash__misty" },
        { name: "@clearTimestamp", value: "2026-05-04T12:00:00.000Z" },
      ],
    }));
  });
});
