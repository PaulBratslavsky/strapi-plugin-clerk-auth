export interface ClerkAuthPluginConfig {
  clerkSecretKey: string;
  clerkWebhookSecret: string;
  userProfileContentType: string;
}

export default {
  default: {
    clerkSecretKey: '',
    clerkWebhookSecret: '',
    userProfileContentType: '',
  } satisfies ClerkAuthPluginConfig,
  validator(config: Partial<ClerkAuthPluginConfig>) {
    if (!config.clerkSecretKey) {
      throw new Error('[clerk-auth] clerkSecretKey is required in plugin config');
    }
  },
};
