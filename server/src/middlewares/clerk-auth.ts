import { verifyToken } from '@clerk/backend';
import type { Core } from '@strapi/strapi';

export default (config: any, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    strapi.log.debug(`[clerk-auth] Incoming ${ctx.method} ${ctx.url}`);

    const authHeader = ctx.request.header.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      strapi.log.debug('[clerk-auth] No Bearer token found, skipping');
      return next();
    }

    const token = authHeader.slice(7);
    strapi.log.debug(`[clerk-auth] Token received: ${token.slice(0, 20)}...`);

    const pluginConfig = strapi.config.get('plugin::clerk-auth') as {
      clerkSecretKey: string;
    };

    strapi.log.debug(`[clerk-auth] Secret key configured: ${!!pluginConfig.clerkSecretKey}`);

    try {
      strapi.log.debug('[clerk-auth] Verifying token...');
      const payload = await verifyToken(token, {
        secretKey: pluginConfig.clerkSecretKey,
      });

      strapi.log.debug(`[clerk-auth] Token verified. sub=${payload.sub}, email=${payload.email}`);
      strapi.log.debug(`[clerk-auth] Full payload: ${JSON.stringify(payload)}`);

      const clerkUserService = strapi
        .plugin('clerk-auth')
        .service('clerk-user');

      strapi.log.debug(`[clerk-auth] Looking up user by clerkId: ${payload.sub}`);
      let user = await clerkUserService.findByClerkId(payload.sub);
      strapi.log.debug(`[clerk-auth] Existing user: ${user ? `id=${user.id}` : 'NOT FOUND'}`);

      if (!user) {
        const fullName =
          [payload.first_name, payload.last_name].filter(Boolean).join(' ') ||
          null;

        strapi.log.debug(`[clerk-auth] Creating user: clerkId=${payload.sub}, email=${payload.email}, fullName=${fullName}`);

        user = await clerkUserService.createFromClerk({
          clerkId: payload.sub,
          email: payload.email || `${payload.sub}@clerk.user`,
          username: payload.email || payload.sub,
          fullName,
        });

        strapi.log.info(`[clerk-auth] Created new user id=${user.id} for Clerk ID: ${payload.sub}`);
      }

      strapi.log.debug(`[clerk-auth] Setting ctx.state.user = id=${user.id}`);
      ctx.state.user = user;
    } catch (error: any) {
      strapi.log.error(`[clerk-auth] Auth failed: ${error.message}`);
      strapi.log.error(`[clerk-auth] Stack: ${error.stack}`);
    }

    return next();
  };
};
