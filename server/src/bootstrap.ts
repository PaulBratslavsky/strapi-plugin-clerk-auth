import type { Core } from '@strapi/strapi';
import type { ClerkAuthPluginConfig } from './config';

function generateUsername(): string {
  const adjectives = ['Swift', 'Brave', 'Clever', 'Mighty', 'Silent', 'Witty', 'Bold', 'Eager'];
  const nouns = ['Tiger', 'Eagle', 'Shark', 'Wolf', 'Falcon', 'Panda', 'Dragon', 'Hawk'];
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${randomAdjective}${randomNoun}${randomNumber}`;
}

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  // Validate that clerkId field exists on user model
  const userAttributes = strapi.contentTypes['plugin::users-permissions.user']?.attributes;

  if (!userAttributes?.clerkId) {
    strapi.log.error(
      '[clerk-auth] "clerkId" field not found on user model. ' +
        'The register phase may not have run correctly.'
    );
  }

  // If userProfileContentType is configured, subscribe to user lifecycle events
  const { userProfileContentType: profileContentType } = strapi.config.get<ClerkAuthPluginConfig>('plugin::clerk-auth');

  if (profileContentType) {
    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],

      async afterCreate(event: any) {
        const { result, params } = event;
        const fullName = params?.data?.fullName;

        try {
          const existing = await strapi.documents(profileContentType as any).findMany({
            filters: { user: { id: { $eq: result.id } } },
          });

          if (existing.length > 0) {
            return;
          }

          await strapi.documents(profileContentType as any).create({
            data: {
              user: result.id,
              name: fullName || generateUsername(),
            } as any,
          });

          strapi.log.info(`[clerk-auth] Created profile for user ${result.id}`);
        } catch (error: any) {
          strapi.log.error(`[clerk-auth] Failed to create profile: ${error.message}`);
        }
      },

      async beforeDelete(event: any) {
        const { params } = event;
        const idToDelete = params?.where?.id;

        if (!idToDelete) return;

        try {
          const profiles = await strapi.documents(profileContentType as any).findMany({
            filters: { user: { id: { $eq: idToDelete } } },
          });

          if (profiles.length > 0) {
            await strapi.documents(profileContentType as any).delete({
              documentId: profiles[0].documentId,
            });
            strapi.log.info(`[clerk-auth] Deleted profile for user ${idToDelete}`);
          }
        } catch (error: any) {
          strapi.log.error(`[clerk-auth] Failed to delete profile: ${error.message}`);
        }
      },
    });

    strapi.log.info(`[clerk-auth] User profile lifecycle hooks registered for ${profileContentType}`);
  }
};

export default bootstrap;
