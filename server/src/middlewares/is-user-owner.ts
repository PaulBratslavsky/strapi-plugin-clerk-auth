import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';

type StrapiContext = Context & {
  state: { user?: { id: number } };
  params: { id?: string };
  unauthorized(message: string): void;
  forbidden(message: string): void;
};

const isUserOwner = (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async function authorize(ctx: StrapiContext, next: () => Promise<void>) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You are not authenticated.');
    }

    const requestedUserId = ctx.params.id;

    if (!requestedUserId) {
      return next();
    }

    if (ctx.state.user.id !== Number(requestedUserId)) {
      strapi.log.warn(`[clerk-auth] User ${ctx.state.user.id} tried to access user ${requestedUserId}`);
      return ctx.forbidden('You are not authorized to perform this action.');
    }

    return next();
  };
};

export default isUserOwner;
