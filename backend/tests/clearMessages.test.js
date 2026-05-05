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

describe("clearMessages API Function", () => {
  let handler;

  beforeAll(() => {
    require("../functions/clearMessages");
    handler = app.http.mock.calls[0][1].handler;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should clear only the current user's view of an accepted friend thread", async () => {
    const request = {
      json: jest.fn().mockResolvedValue({ currentUsername: "ash", targetUsername: "misty" }),
    };
    const context = { log: jest.fn() };
    const currentUser = { id: "user_ash", username: "ash", friends: ["misty"] };
    const targetUser = { id: "user_misty", username: "misty", friends: ["ash"] };
    const replace = jest.fn().mockResolvedValue({});

    authorizeUsername.mockReturnValue({ ok: true, user: { username: "ash" } });
    usersContainer.items.query
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [currentUser] }) })
      .mockReturnValueOnce({ fetchAll: jest.fn().mockResolvedValue({ resources: [targetUser] }) });
    usersContainer.item.mockReturnValue({ replace });

    const res = await handler(request, context);

    expect(res.status).toBe(200);
    expect(currentUser.chatClears.ash__misty).toEqual(expect.any(String));
    expect(usersContainer.item).toHaveBeenCalledWith("user_ash", "user_ash");
    expect(replace).toHaveBeenCalledWith(currentUser);
  });
});
