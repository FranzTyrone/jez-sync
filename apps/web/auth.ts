import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session: sessionUpdate }) {
      if (user) { token.id = user.id; token.image = (user as any).image ?? null; }
      if (trigger === "update" && sessionUpdate?.image !== undefined) token.image = sessionUpdate.image;
      if (trigger === "update" && sessionUpdate?.name !== undefined) token.name = sessionUpdate.name;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).image = token.image as string | null;
      }
      return session;
    },
  },
});