import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // --- Extend the User content type with clerkId and fullName ---
  const userContentType = strapi.contentTypes['plugin::users-permissions.user'];

  userContentType.attributes.clerkId = {
    type: 'string',
    unique: true,
    configurable: false,
  } as any;

  userContentType.attributes.fullName = {
    type: 'string',
  } as any;

  strapi.log.info('[clerk-auth] Added clerkId and fullName fields to User model');

  // --- Inject middlewares onto users-permissions routes ---
  const userRoutes = strapi.plugins['users-permissions'].routes['content-api'].routes;

  const clerkAuthMiddleware = 'plugin::clerk-auth.clerk-auth';
  const isUserOwnerMiddleware = 'plugin::clerk-auth.is-user-owner';

  const clerkAuthTargets = ['user.find', 'user.findOne', 'user.update', 'user.destroy', 'user.me'];
  const ownerTargets = ['user.findOne', 'user.update', 'user.destroy'];

  function initializeRoute(route: any) {
    route.config = route.config || {};
    route.config.middlewares = route.config.middlewares || [];
    route.config.policies = route.config.policies || [];
  }

  for (const route of userRoutes) {
    const handler = route.handler;

    if (clerkAuthTargets.includes(handler)) {
      initializeRoute(route);
      // Disable Strapi's built-in auth — our clerk-auth middleware handles it.
      // Without this, Strapi rejects the Clerk JWT before our middleware runs.
      route.config.auth = false;
      if (!route.config.middlewares.includes(clerkAuthMiddleware)) {
        route.config.middlewares.unshift(clerkAuthMiddleware);
      }
    }

    if (ownerTargets.includes(handler)) {
      initializeRoute(route);
      if (!route.config.middlewares.includes(isUserOwnerMiddleware)) {
        route.config.middlewares.push(isUserOwnerMiddleware);
      }
    }
  }

  strapi.log.info('[clerk-auth] Middlewares registered on users-permissions routes');
};

export default register;
