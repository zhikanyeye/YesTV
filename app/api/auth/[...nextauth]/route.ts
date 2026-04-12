import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import QQProvider from "next-auth/providers/qq";

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    QQProvider({
      clientId: process.env.QQ_APP_ID!,
      clientSecret: process.env.QQ_APP_KEY!,
    }),
  ],
  secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
