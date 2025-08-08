// src/server/auth/config.ts
import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      tenantId: string | null;
      role: UserRole;
      tenantName?: string;
      tenantSlug?: string;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId: string | null;
    role: UserRole;
    lastLoginAt: Date | null;
    password?: string;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        // For users created via script without password, allow any password initially
        // In production, you'd want proper password validation
        if (!user.password) {
          // Hash and save the password they just used
          const hashedPassword = await bcrypt.hash(
            credentials.password as string,
            12,
          );
          await db.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
          });
        } else {
          // Verify password
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password,
          );
          if (!isValid) {
            return null;
          }
        }

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tenantId: user.tenantId,
          role: user.role,
        };
      },
    }),
  ],

  adapter: PrismaAdapter(db),

  callbacks: {
    session: async ({ session, token }) => {
      if (token?.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.tenantId = dbUser.tenantId;
          session.user.role = dbUser.role;
          session.user.tenantName = dbUser.tenant?.name;
          session.user.tenantSlug = dbUser.tenant?.slug;
        }
      }

      return session;
    },

    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
  },

  /**
   * Custom pages for authentication flows
   */
  pages: {
    signIn: "/auth/signin",
  },

  /**
   * Session configuration
   */
  session: {
    strategy: "jwt", // Use JWT for credentials provider
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  /**
   * Security options
   */
  useSecureCookies: process.env.NODE_ENV === "production",
} satisfies NextAuthConfig;
