import NextAuth, { AuthOptions } from "next-auth";
import type { UserinfoEndpointHandler } from "next-auth/providers/oauth";
import GithubProvider from "next-auth/providers/github";
import { isUserBanned, upsertManagedUser } from '@/lib/user-management';

interface QQProfile {
  id: string;
  nickname: string;
  figureurl_qq_1?: string;
  figureurl_qq_2?: string;
}

type QQRequestContext = Parameters<NonNullable<UserinfoEndpointHandler["request"]>>[0];

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const qqClientId = process.env.QQ_APP_ID;
const qqClientSecret = process.env.QQ_APP_KEY;

export const authOptions: AuthOptions = {
  providers: [
    ...(githubClientId && githubClientSecret
      ? [GithubProvider({
          clientId: githubClientId,
          clientSecret: githubClientSecret,
        })]
      : []),
    ...(qqClientId && qqClientSecret ? [{
      id: "qq",
      name: "QQ",
      type: "oauth" as const,
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
        async request(context: QQRequestContext) {
          const accessToken = context.tokens.access_token as string;
          const me = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`);
          const responseText = await me.text();
          const { openid } = JSON.parse(responseText.replace(/callback\(|\);/g, '')) as { openid: string };
          const user = await fetch(`https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${context.provider.clientId}&openid=${openid}`);
          const qqUser = await user.json() as QQProfile;
          return { ...qqUser, id: openid, name: qqUser.nickname };
        }
      },
      profile(profile: QQProfile) {
        return {
          id: profile.id,
          name: profile.nickname,
          email: null,
          image: profile.figureurl_qq_2 || profile.figureurl_qq_1,
        };
      },
      clientId: qqClientId,
      clientSecret: qqClientSecret,
    }] : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) {
        return false;
      }

      try {
        const banned = await isUserBanned(user.id);
        if (banned) {
          return false;
        }

        await upsertManagedUser({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        });
      } catch (error) {
        console.error('Failed to synchronize signed-in user:', error);
      }

      return true;
    },
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
