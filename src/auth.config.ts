import type { NextAuthConfig } from "next-auth";

// We use a fallback secret for development if the env var is missing
// to prevent the 'MissingSecret' error that blocks the entire app.
export const authConfig = {
  secret: process.env.AUTH_SECRET || "development-secret-do-not-use-in-production-1234567890",
  providers: [], 
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname.startsWith("/login");
      
      if (!isLoggedIn && !isOnLoginPage) {
        return false; // Redirect to login
      }
      if (isLoggedIn && isOnLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
