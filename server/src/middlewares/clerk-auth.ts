import { verifyToken } from '@clerk/backend';
import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { ClerkAuthPluginConfig } from '../config';

type StrapiContext = Context & {
  state: { user?: any };
};

function extractBearerToken(ctx: StrapiContext): string | null {
  const authHeader = ctx.request.header.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function buildFullName(firstName: unknown, lastName: unknown): string | null {
  const parts = [firstName, lastName].filter((v): v is string => typeof v === 'string' && v.length > 0);
  return parts.length > 0 ? parts.join(' ') : null;
}

const clerkAuth = (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const { clerkSecretKey } = strapi.config.get<ClerkAuthPluginConfig>('plugin::clerk-auth');
  const service = strapi.plugin('clerk-auth').service('clerk-user');

  return async function authenticate(ctx: StrapiContext, next: () => Promise<void>) {
    const token = extractBearerToken(ctx);

    if (!token) {
      strapi.log.debug('[clerk-auth] No Bearer token, skipping');
      return next();
    }

    strapi.log.debug(`[clerk-auth] Verifying token for ${ctx.method} ${ctx.url}`);

    try {
      const payload = await verifyToken(token, { secretKey: clerkSecretKey });
      const email = typeof payload.email === 'string' ? payload.email : null;

      strapi.log.debug(`[clerk-auth] Token verified: sub=${payload.sub}`);

      let user = await service.findByClerkId(payload.sub);

      if (!user) {
        user = await service.createFromClerk({
          clerkId: payload.sub,
          email: email || `${payload.sub}@clerk.user`,
          username: email || payload.sub,
          fullName: buildFullName(payload.first_name, payload.last_name),
        });
        strapi.log.info(`[clerk-auth] Created user id=${user.id} for Clerk ID: ${payload.sub}`);
      }

      ctx.state.user = user;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      strapi.log.error(`[clerk-auth] Auth failed: ${message}`);
    }

    return next();
  };
};

export default clerkAuth;
