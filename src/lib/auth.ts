/**
 * NextAuth configuration
 * Supports GitHub OAuth and guest PIN authentication
 */

import { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';

export const auth_options: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      id: 'guest-pin',
      name: 'Guest PIN',
      credentials: {
        pin: { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        const guest_pin = process.env.GUEST_PIN;

        if (!guest_pin) {
          return null;
        }

        if (credentials?.pin === guest_pin) {
          return {
            id: 'guest',
            name: 'Guest',
            email: 'guest@onthisday.local',
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user, account }) {
      // Allow all GitHub users or guests with valid PIN
      if (account?.provider === 'guest-pin') {
        return true;
      }

      // Optional: restrict to specific GitHub username
      // const allowed_users = ['boneshakerbike'];
      // if (account?.provider === 'github' && !allowed_users.includes(user.name ?? '')) {
      //   return false;
      // }

      return true;
    },
    async session({ session, token }) {
      // Add user info to session
      if (token.sub) {
        session.user = session.user ?? {};
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
