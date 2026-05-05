const normalizeUsername = (username) => String(username || "").toLowerCase().trim();

const getThreadId = (usernameA, usernameB) => {
  const users = [normalizeUsername(usernameA), normalizeUsername(usernameB)].sort();
  return `${users[0]}__${users[1]}`;
};

const fetchUserByUsername = async (usersContainer, username) => {
  const normalizedUsername = normalizeUsername(username);
  const { resources } = await usersContainer.items.query({
    query: "SELECT * FROM c WHERE c.username = @username",
    parameters: [{ name: "@username", value: normalizedUsername }],
  }).fetchAll();

  return resources[0] || null;
};

const loadFriendPair = async (usersContainer, currentUsername, targetUsername) => {
  const normalizedCurrentUsername = normalizeUsername(currentUsername);
  const normalizedTargetUsername = normalizeUsername(targetUsername);

  if (!normalizedCurrentUsername || !normalizedTargetUsername) {
    return { error: { status: 400, jsonBody: { success: false, error: "Both usernames are required." } } };
  }

  if (normalizedCurrentUsername === normalizedTargetUsername) {
    return { error: { status: 400, jsonBody: { success: false, error: "You cannot open a chat with yourself." } } };
  }

  const [currentUser, targetUser] = await Promise.all([
    fetchUserByUsername(usersContainer, normalizedCurrentUsername),
    fetchUserByUsername(usersContainer, normalizedTargetUsername),
  ]);

  if (!currentUser || !targetUser) {
    return { error: { status: 404, jsonBody: { success: false, error: "User not found." } } };
  }

  const currentFriends = currentUser.friends || [];
  const targetFriends = targetUser.friends || [];
  const areFriends =
    currentFriends.includes(normalizedTargetUsername) &&
    targetFriends.includes(normalizedCurrentUsername);

  if (!areFriends) {
    return { error: { status: 403, jsonBody: { success: false, error: "You can only message accepted friends." } } };
  }

  return {
    currentUser,
    targetUser,
    currentUsername: normalizedCurrentUsername,
    targetUsername: normalizedTargetUsername,
    threadId: getThreadId(normalizedCurrentUsername, normalizedTargetUsername),
  };
};

module.exports = {
  normalizeUsername,
  getThreadId,
  loadFriendPair,
};
