import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: AuthOptions = {
  // Signed-in sessions expire after 3 days of inactivity (NextAuth's
  // default is 30) — farm PCs/phones are often left logged in, so this
  // caps how long a stolen/left-open session stays valid.
  session: { strategy: "jwt", maxAge: 3 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: credentials.username.trim().toLowerCase() },
        });
        if (!user) return null;

        // Locked stays locked even against the right password — only an
        // admin clearing it (Settings > Users > Unlock) lifts this.
        if (user.lockedAt) throw new Error("locked");

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: attempts, lockedAt: attempts >= 3 ? new Date() : null },
          });
          if (attempts >= 3) throw new Error("locked");
          return null;
        }

        if (user.failedLoginAttempts > 0) {
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } });
        }
        return { id: user.id, name: user.name, username: user.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.username = (user as { username: string }).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { username?: string }).username = token.username as string;
      }
      return session;
    },
  },
};
