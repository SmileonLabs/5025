function enabled(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value == null) return defaultValue;
  return value === "true" || value === "1";
}

export const readingFeatureFlags = {
  conversationEnabled: enabled("READING_CONVERSATION_ENABLED"),
  bookMissionsEnabled: enabled("BOOK_MISSIONS_ENABLED"),
  autoApproveEnabled: enabled("AI_REWARD_AUTO_APPROVE_ENABLED"),
};
