import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Trust the deployment host so callback URLs resolve behind Vercel's proxy.
  trustHost: true,
  providers: [
    // Link a Google sign-in to an existing account with the same (Google-verified)
    // email — otherwise users who registered with email/password hit
    // OAuthAccountNotLinked when signing in with Google.
    Google({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // No user, or an OAuth-only account without a password set.
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          isGuest: user.isGuest,
          language: user.language,
        };
      },
    }),
    // Passwordless sign-in as the shared read-only demo account.
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      async authorize() {
        const guest = await prisma.user.findFirst({ where: { isGuest: true } });
        if (!guest) return null;
        return {
          id: guest.id,
          name: guest.name,
          email: guest.email,
          image: guest.image,
          isGuest: true,
          language: guest.language,
        };
      },
    }),
  ],
  // Credentials provider requires JWT sessions (DB sessions aren't supported
  // for it). OAuth accounts are still persisted via the Prisma adapter.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // `user` is the authorize() return (credentials) or adapter row (OAuth);
        // both carry isGuest + language.
        token.isGuest = Boolean((user as { isGuest?: boolean }).isGuest);
        token.language = (user as { language?: string }).language;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.isGuest = Boolean(token.isGuest);
        session.user.language = token.language as string | undefined;
      }
      return session;
    },
  },
});
