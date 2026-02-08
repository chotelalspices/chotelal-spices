import NextAuth, { AuthOptions } from 'next-auth';
import CredentialsProviders from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { PrismaAdapter } from '@next-auth/prisma-adapter';

import prisma from "@/lib/prisma";

export const authOptions: AuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        CredentialsProviders({
            name: 'credentials',
            credentials: {
                email: { label: "email", type: "text" },
                password: { label: "password", type: "password" },
            },
            async authorize(credentials) {
                if(!credentials?.email || !credentials?.password) {
                    throw new Error('Invalid Credentials')
                }

                const user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email
                    },
                    include: {
                        userRoles: {
                            select: { role: true }
                        }
                    }
                })

                if(!user || !user?.hashedPassword) {
                    throw new Error('Invalid Credentials')
                }

                if(user.status === 'inactive') {
                    throw new Error('User is inactive')
                }

                const isCorrectPassword = await bcrypt.compare(
                    credentials.password,
                    user.hashedPassword
                )

                if(!isCorrectPassword) {
                    throw new Error('Invalid Credentials')
                }

                // Update lastLogin field
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastLogin: new Date() }
                });

                return {
                    ...user,
                    roles: user.userRoles.map(ur => ur.role)
                };
            }
        })
    ],
    debug: process.env.NODE_ENV === 'development',
    session: {
        strategy: 'jwt',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.fullName = (user as any).fullName;
                token.roles = (user as any).roles || [];
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id as string;
                (session.user as any).fullName = token.fullName as string;
                (session.user as any).roles = token.roles as string[];
            }
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }