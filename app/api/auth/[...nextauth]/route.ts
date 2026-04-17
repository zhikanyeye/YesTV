import NextAuth, { AuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    {
      id: "qq",
      name: "QQ",
      type: "oauth",
      version: "2.0",
      authorization: {
        url: "https://graph.qq.com/oauth2.0/authorize",
        params: { scope: "get_user_info" },
      },
      token: {
        url: "https://graph.qq.com/oauth2.0/token",
      },
      userinfo: {
        url: "https://graph.qq.com/oauth2.0/me",
        async request(context: any) {
          const me = await fetch(context.token.userinfo.url + "?access_token=" + context.token.access_token);
          let openid = await me.text();
          openid = JSON.parse(openid.replace(/callback\(|\);/g, '')).openid;
          const user = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${context.token.access_token}&oauth_consumer_key=${context.provider.clientId}&openid=${openid}`);
          const qqUser = await user.json();
          return { ...qqUser, id: openid };
        }
      },
      profile(profile: any) {
        return {
          id: profile.id,
          name: profile.nickname,
          email: null,
          image: profile.figureurl_qq_2 || profile.figureurl_qq_1,
        };
      },
      clientId: process.env.QQ_APP_ID!,
      clientSecret: process.env.QQ_APP_KEY!,
    },
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || token.sub || "";
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
