import { Webhook } from 'svix';
import type { Core } from '@strapi/strapi';

const webhook = ({ strapi }: { strapi: Core.Strapi }) => ({
  async handle(ctx: any) {
    const payload = ctx.request.body;
    const headers = ctx.request.headers;

    const pluginConfig = strapi.config.get('plugin::clerk-auth') as {
      clerkWebhookSecret: string;
    };

    // Verify webhook signature if secret is configured
    if (pluginConfig.clerkWebhookSecret) {
      try {
        const wh = new Webhook(pluginConfig.clerkWebhookSecret);
        wh.verify(JSON.stringify(payload), {
          'svix-id': headers['svix-id'] as string,
          'svix-timestamp': headers['svix-timestamp'] as string,
          'svix-signature': headers['svix-signature'] as string,
        });
      } catch (err) {
        strapi.log.error('[clerk-auth] Webhook signature verification failed');
        return ctx.badRequest('Invalid signature');
      }
    }

    const { type, data } = payload;

    const clerkUserService = strapi
      .plugin('clerk-auth')
      .service('clerk-user');

    switch (type) {
      case 'user.created':
      case 'user.updated': {
        const email = data.email_addresses?.[0]?.email_address;
        const fullName =
          [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

        const existing = await clerkUserService.findByClerkId(data.id);

        if (existing) {
          await clerkUserService.updateFromClerk(existing.id, {
            email: email || existing.email,
            username: data.username || email || data.id,
            fullName: fullName || existing.fullName,
          });
          strapi.log.info(`[clerk-auth] Webhook updated user for Clerk ID: ${data.id}`);
        } else {
          await clerkUserService.createFromClerk({
            clerkId: data.id,
            email: email || `${data.id}@clerk.user`,
            username: data.username || email || data.id,
            fullName,
          });
          strapi.log.info(`[clerk-auth] Webhook created user for Clerk ID: ${data.id}`);
        }
        break;
      }

      case 'user.deleted': {
        const deleted = await clerkUserService.deleteByClerkId(data.id);
        if (deleted) {
          strapi.log.info(`[clerk-auth] Webhook deleted user for Clerk ID: ${data.id}`);
        }
        break;
      }
    }

    ctx.send({ received: true });
  },
});

export default webhook;
