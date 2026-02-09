import type { Core } from '@strapi/strapi';

export default (config: any, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (!ctx.state?.user) {
      return ctx.unauthorized('You are not authenticated.');
    }

    const requestedUserId = ctx.params?.id;

    // Skip ownership check for routes without :id (e.g. /users/me)
    if (!requestedUserId) {
      return next();
    }

    const currentUserId = ctx.state.user.id;

    if (Number(currentUserId) !== Number(requestedUserId)) {
      strapi.log.warn(
        `[clerk-auth] User ${currentUserId} tried to access user ${requestedUserId}`
      );
      return ctx.forbidden('You are not authorized to perform this action.');
    }

    await next();
  };
};
