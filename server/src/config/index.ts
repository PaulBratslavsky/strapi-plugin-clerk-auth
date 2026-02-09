export default {
  default: {
    clerkSecretKey: '',
    clerkWebhookSecret: '',
    userProfileContentType: '',
  },
  validator(config: { clerkSecretKey?: string }) {
    if (!config.clerkSecretKey) {
      throw new Error('[clerk-auth] clerkSecretKey is required in plugin config');
    }
  },
};
