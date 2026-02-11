import type { Core } from '@strapi/strapi';
import type { Schema } from '@strapi/types';

const CLERK_AUTH = 'plugin::clerk-auth.clerk-auth';
const IS_USER_OWNER = 'plugin::clerk-auth.is-user-owner';

type InitializedRouteConfig = Required<Pick<Core.RouteConfig, 'middlewares' | 'policies'>> & Core.RouteConfig;
type RouteWithConfig = Core.Route & { config: InitializedRouteConfig };

const authRoutes = new Set<Core.HandlerReference>(['user.find', 'user.findOne', 'user.update', 'user.destroy', 'user.me']);
const ownerRoutes = new Set<Core.HandlerReference>(['user.findOne', 'user.update', 'user.destroy']);

function ensureRouteConfig(route: Core.Route): asserts route is RouteWithConfig {
  route.config ??= {};
  route.config.middlewares ??= [];
  route.config.policies ??= [];
}

function addMiddleware(route: RouteWithConfig, middleware: string, position: 'start' | 'end') {
  if (!route.config.middlewares.includes(middleware)) {
    position === 'start'
      ? route.config.middlewares.unshift(middleware)
      : route.config.middlewares.push(middleware);
  }
}

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // --- Extend the User content type with clerkId and fullName ---
  // Cast needed: we're dynamically adding fields that don't exist in the
  // users-permissions type definitions. The attribute values themselves are
  // valid Schema.Attribute.String shapes — but TypeScript can't know about
  // keys added at runtime.
  const userAttributes = strapi.contentTypes['plugin::users-permissions.user']
    .attributes as Record<string, Schema.Attribute.AnyAttribute>;

  userAttributes.clerkId = {
    type: 'string',
    unique: true,
    configurable: false,
  };

  userAttributes.fullName = {
    type: 'string',
  };

  strapi.log.info('[clerk-auth] Added clerkId and fullName fields to User model');

  // --- Inject middlewares onto users-permissions routes ---
  const userRoutes = strapi.plugins['users-permissions'].routes['content-api'].routes;

  for (const route of userRoutes) {
    const { handler } = route;
    if (typeof handler !== 'string' || !authRoutes.has(handler)) continue;

    ensureRouteConfig(route);

    // Disable Strapi's built-in auth — our clerk-auth middleware handles it.
    // Without this, Strapi rejects the Clerk JWT before our middleware runs.
    route.config.auth = false;
    addMiddleware(route, CLERK_AUTH, 'start');

    if (ownerRoutes.has(handler)) {
      addMiddleware(route, IS_USER_OWNER, 'end');
    }
  }

  strapi.log.info('[clerk-auth] Middlewares registered on users-permissions routes');
};

export default register;
