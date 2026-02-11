import { Webhook } from 'svix';
import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { ClerkAuthPluginConfig } from '../config';

// Strapi extends Koa's Context with helpers that aren't exported as types.
type StrapiContext = Context & {
  badRequest(message: string): void;
  send(body: unknown): void;
};

type ClerkWebhookEvent = 'user.created' | 'user.updated' | 'user.deleted';

interface ClerkWebhookPayload {
  type: ClerkWebhookEvent;
  data: {
    id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    email_addresses?: { email_address: string }[];
  };
}

function getHeader(headers: Context['headers'], name: string): string {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value ?? '';
}

function buildFullName(data: ClerkWebhookPayload['data']): string | null {
  return [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
}

async function handleUserCreateOrUpdate(data: ClerkWebhookPayload['data'], service: any, log: Core.Strapi['log']) {
  const email = data.email_addresses?.[0]?.email_address;
  const fullName = buildFullName(data);
  const existing = await service.findByClerkId(data.id);

  if (existing) {
    await service.updateFromClerk(existing.id, {
      email: email || existing.email,
      username: data.username || email || data.id,
      fullName: fullName || existing.fullName,
    });
    log.info(`[clerk-auth] Webhook updated user for Clerk ID: ${data.id}`);
  } else {
    await service.createFromClerk({
      clerkId: data.id,
      email: email || `${data.id}@clerk.user`,
      username: data.username || email || data.id,
      fullName,
    });
    log.info(`[clerk-auth] Webhook created user for Clerk ID: ${data.id}`);
  }
}

async function handleUserDelete(data: ClerkWebhookPayload['data'], service: any, log: Core.Strapi['log']) {
  const deleted = await service.deleteByClerkId(data.id);
  if (deleted) {
    log.info(`[clerk-auth] Webhook deleted user for Clerk ID: ${data.id}`);
  }
}

const webhook = ({ strapi }: { strapi: Core.Strapi }) => ({
  async handle(ctx: StrapiContext) {
    const { clerkWebhookSecret } = strapi.config.get<ClerkAuthPluginConfig>('plugin::clerk-auth');

    if (clerkWebhookSecret) {
      try {
        const wh = new Webhook(clerkWebhookSecret);
        wh.verify(JSON.stringify(ctx.request.body), {
          'svix-id': getHeader(ctx.headers, 'svix-id'),
          'svix-timestamp': getHeader(ctx.headers, 'svix-timestamp'),
          'svix-signature': getHeader(ctx.headers, 'svix-signature'),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        strapi.log.error(`[clerk-auth] Webhook signature verification failed: ${message}`);
        return ctx.badRequest('Invalid signature');
      }
    }

    const { type, data } = ctx.request.body as ClerkWebhookPayload;
    const service = strapi.plugin('clerk-auth').service('clerk-user');

    switch (type) {
      case 'user.created':
      case 'user.updated':
        await handleUserCreateOrUpdate(data, service, strapi.log);
        break;
      case 'user.deleted':
        await handleUserDelete(data, service, strapi.log);
        break;
    }

    ctx.send({ received: true });
  },
});

export default webhook;
