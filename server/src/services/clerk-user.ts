import type { Core } from '@strapi/strapi';

// ---------- Types for the host-extended User model ----------
// users-permissions plugin uses id (not documentId) and does not
// support strapi.documents(). We use strapi.db.query() which is
// the correct API for this plugin.

export interface ClerkUser {
  id: number;
  clerkId: string;
  email: string;
  username: string;
  fullName: string | null;
  confirmed: boolean;
  role: { id: number; type: string } | null;
}

export interface ClerkUserInput {
  clerkId?: string;
  email?: string;
  username?: string;
  fullName?: string | null;
  role?: number;
  confirmed?: boolean;
}

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';

// ---------- Service ----------

const clerkUser = ({ strapi }: { strapi: Core.Strapi }) => ({
  async findByClerkId(clerkId: string): Promise<ClerkUser | null> {
    strapi.log.debug(`[clerk-user] findByClerkId: ${clerkId}`);
    const users = await strapi.db.query(USER_UID).findMany({
      where: { clerkId },
      populate: ['role'],
    }) as ClerkUser[];

    strapi.log.debug(`[clerk-user] findByClerkId result: ${users.length} user(s) found`);
    return users.length > 0 ? users[0] : null;
  },

  async createFromClerk(data: {
    clerkId: string;
    email: string;
    username: string;
    fullName: string | null;
  }): Promise<ClerkUser> {
    strapi.log.debug(`[clerk-user] createFromClerk: ${JSON.stringify(data)}`);

    const roles = await strapi.db.query(ROLE_UID).findMany({
      where: { type: 'authenticated' },
    });
    strapi.log.debug(`[clerk-user] Found ${roles.length} authenticated role(s): ${JSON.stringify(roles.map((r: any) => ({ id: r.id, type: r.type })))}`);

    const created = await strapi.db.query(USER_UID).create({
      data: {
        clerkId: data.clerkId,
        email: data.email,
        username: data.username,
        fullName: data.fullName,
        role: roles[0]?.id,
        confirmed: true,
      },
      populate: ['role'],
    }) as ClerkUser;

    strapi.log.debug(`[clerk-user] Created user: id=${created.id}, email=${created.email}`);
    return created;
  },

  async updateFromClerk(
    userId: number,
    data: Partial<ClerkUserInput>
  ): Promise<ClerkUser> {
    return strapi.db.query(USER_UID).update({
      where: { id: userId },
      data,
      populate: ['role'],
    }) as Promise<ClerkUser>;
  },

  async deleteByClerkId(clerkId: string): Promise<boolean> {
    const user = await this.findByClerkId(clerkId);

    if (user) {
      await strapi.db.query(USER_UID).delete({
        where: { id: user.id },
      });
      return true;
    }

    return false;
  },
});

export default clerkUser;
