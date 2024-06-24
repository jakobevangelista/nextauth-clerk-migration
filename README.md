# Migration Guide: Moving from Next-Auth to Clerk 

## Introduction

Migrating from Next-Auth to Clerk can be daunting, but this guide aims to help you achieve a seamless transition with zero downtime. This guide covers running both middlewares simultaneously, importing users while keeping your application active, and ensuring a smooth experience for your users.

## Prerequisites

Before you begin, ensure you have the following:

- An active Clerk account.
- Your current application using Next-Auth.
- Access to your user database.

## Migration Overview

To ensure a smooth migration with minimal disruption to your users, we will follow these steps:
1. **Install @clerk/nextjs**
2. **Add Clerk Middleware**
3. **Add Clerk provider**
4. **Implement Trickle Migration**
5. **Implement batch migration**
6. **Switch Data Access Patterns to Clerk**
7. **Implement Sign-up and Sign-in with Clerk**
8. **Turn off all next-auth things and switch to clerk**

During migration, there are going to be 2 major states for your app, we label them as "during the migration" and "after the migration".

## Migration Steps

## During the migration ('migrating' Branch)
### 1. Install @clerk/nextjs

(I dont know how to do the cool tabbed thing to install in npm, yarn, pnpm, bun but once I learn how to do it, imma do it)

Install @clerk/nextjs

```bash
npm install @clerk/nextjs
```
```bash
yarn add @clerk/nextjs
```
```bash
pnpm add @clerk/nextjs
```
```bash
bun add @clerk/nextjs
```

### 2. Add Clerk Middleware

We need Clerk's middleware in order to use useSign in.

First, add the Clerk middleware alongside the existing NextAuth middleware. Clerk middleware has to be the top wrapper for the entire middleware. In the example provided, we put a sample middleware functions within the next auth middleware, you can add whatever custom middleware functions you have.


```js
// src/app/middleware.ts

import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);
const nextAuthMiddle = auth(function middleware(req) {
  // custom middleware functions here
});

export default clerkMiddleware(async (clerkauth, req) => {
  await nextAuthMiddle(req); // works but needs AppRouteHandlerFnContext
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### 3. Wrap Application in &lt;ClerkProvider> and &lt;MigrationLayout> and &lt;QueryClient>

Wrap your application layout in the &lt;ClerkProvider> component to enable Clerk authentication. Also wrap the &lt;MigrationLayout> component, this allows users that are already signed into next-auth to seamlessly sign into clerk.

```js #2,#20,#26
// src/app/layout.tsx
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

```

### 4. Trickle Migration

To seamlessly transition your users from NextAuth to Clerk without any downtime, use the following code. This code will automatically create and sign in users in Clerk who were previously authenticated with NextAuth. To achieve this, we wrap your app in a template.js file. This file handles the creation and sign-in of users in the background, allowing your app to continue functioning normally.

#### Server-Side

Create a server-side function that checks if the current NextAuth user exists in Clerk. If not, create the user in Clerk, generate a sign-in token, and pass it to the frontend.

We are using the "external_id" attribute within the createUser function. This allows users to have a tenet table to store all user attributes outside of clerk in their own user table.

If you would like to use the user metadata section in Clerk's user object, we have a guide down below in the "Data Access" patterns sections in order to do this.

(When we change the api, we can tell them they can set userid instead of setting external id)


```js
// src/app/api/signInToken/route.tsx
import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import {
  auth as clerkAuthFunction,
  clerkClient,
  type User,
} from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  const { userId }: { userId: string | null } = clerkAuthFunction();

// we use these custom codes to tell the frontend that the user is already logged in
  if (userId) return new Response("User already exists", { status: 222 });
  if (!session?.user?.email)
    return new Response("User not signed into next auth", { status: 222 });

  // checks for user email already existing (inserted from batch import)
  const searchUser = await clerkClient.users.getUserList({
    emailAddress: [session.user.email],
  });

  let createdUser: User | null | undefined = null;
  console.log("CREATING USER");
  if (searchUser.data.length > 0) {
    createdUser = searchUser.data[0];
  } else {
    const user = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });

    if (!user) throw new Error("User not found");
    // creates user in clerk, with password if it exists, and externalId as the user id
    // to access tenet table attributes
    createdUser = await clerkClient.users.createUser({
      emailAddress: [session.user.email],
      password: user.password ?? undefined,
      skipPasswordChecks: true,
      externalId: `${user.id}`,
    });
  }

  if (!createdUser) throw new Error("User not created");

  // creates sign in token for user
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const signInToken: { token: string } = await fetch(
    "https://api.clerk.com/v1/sign_in_tokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
      body: JSON.stringify({
        user_id: createdUser.id,
      }),
    }
  ).then(async (res) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await res.json();
  });

  if (!signInToken.token) throw new Error("Sign in token not created");

  console.log("WERE SUPPOSED TO BE HERE ON INITIAL SIGN UP");
  return new Response(JSON.stringify({ token: signInToken.token }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

```

#### Client Side Component

Ok, I know this seems scary but let me talk you through it. Here we call the backend api we just wrote to create the user in clerk and fetch the sign in token.

In the fetch useEffect, we are using a package calle p-retry, all this package does is implement exponential backoff when the fetch function fails. This is to solve the thundering herd of 10,000 current active users using your app with our createUser ratelimit of 20req/10sec.

The second useEffect takes the token, and signs the user in. We do this by extracting signIn and setActive from useSignIn().

```js
// src/app/trickleWrapper.tsx

"use client";

import { useSession, useSignIn, useUser } from "@clerk/nextjs";
import pRetry from "p-retry";
import { useEffect, useRef, useState } from "react";

export default function TestRQComponent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();
  const { session } = useSession();
  const fetchRan = useRef<boolean>(false);
  const [signInId, setSignInId] = useState<string | null>(null);
  const [signInToken, setSignInToken] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchRan.current) {
      if (signInToken !== null || signInId !== null) return;

      const myFetch = async () => {
        const res = await pRetry(
          async () => {
            const res = await fetch("/api/signInToken", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              cache: "force-cache",
            });
            return res;
          },
          {
            retries: 100,
            onFailedAttempt: (error) => {
              console.log(`Attempt ${error.attemptNumber} failed.`);
            },
          }
        );

        if (res.status === 222) {
          setSignInToken("none");
          return;
        }

        const data = await res.json();
        setSignInToken(data.token);
      };
      void myFetch();
    }
    return (): void => {
      fetchRan.current = true;
    };
  }, [signInToken, signInId]);

  useEffect(() => {
    // gets the token from query and signs the user in
    if (
      !signIn ||
      !setActive ||
      session ||
      signInId !== null ||
      signInToken === null ||
      signInToken === "none"
    ) {
      return;
    }

    const createSignIn = async () => {
      if (
        !signIn ||
        !setActive ||
        signInId !== null ||
        signInToken === null ||
        signInToken === "none"
      )
        return;

      try {
        const res = await signIn.create({
          strategy: "ticket",
          ticket: signInToken,
        });

        setSignInId(res.createdSessionId);

        void setActive({
          session: res.createdSessionId,
        });
      } catch (error) {
        console.log("ERROR: ", error);
      }
    };

    void createSignIn();
  }, [signIn, setActive, session, signInId, signInToken]);

  return (
    <>
      <div>
        {user ? <div>USER CREATED: {user.id}</div> : null}
        {children}
      </div>
    </>
  );
}

```

#### React 19+
You might notice we are using a useRef in order to prevent a second effect ran in strictmode, a common thing react does. (Insert strictmode docs here). The only reason this ever worked is because "refs not getting in strict mode" was a known bug since 2022, and it is getting fixed in React 19.

### 5. Batch Import

The batch import handles the migration of all users through a scheduled process, ensuring all users are migrated without overwhelming the system and hitting the rate limit (20req/10sec). 

You should start the batch after the thundering herd is done thundering aka the trickle slows below a rate of 20req/10sec. You can fine tune the rate of the batch easily.

#### Script to get all users in existing database within a queue

Store all users in a queue for batch processing. This can be done using a standalone nodejs script. The implementation uses nextjs app router's server components. 

The process is just iterating through all the users, storing them in a queue for the cron job to process individually. Definitely scaling concerns but you can modify this solution to fit your scale.

```js
// src/app/batch/page.tsx
import { db } from "@/server/neonDb";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default function Batch() {
  async function buttonPress() {
    "use server";
    const users = await db.query.users.findMany();

    for (const user of users) {
      await redis.rpush("email", user.email);
      await redis.rpush("password", user.password ?? "null");
      await redis.rpush("id", user.id);
      console.log("IMPORTED: ", user.email);
    }
  }
  return (
    <>
      <form action={buttonPress}>
        <button>Press me</button>
      </form>
    </>
  );
}
```

#### Backend API for Batch Import to import users into Clerk

Use a cron job to process the queue and create users in Clerk, respecting rate limits. This implementation uses Upstash for the cron job running but you can use any job runner of your choice. Again, does not have to be in nextjs, can be any node backend.

You can tune the rate of batching by adjusting the for loop or adjusting the cron job calling interval. 

```js
// src/app/api/batch/route.ts

import { db } from "@/server/neonDb";
import { userAttributes } from "@/server/neonDb/schema";
import { clerkClient } from "@clerk/nextjs/server";
import { Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function POST() {
  const headersList = headers();
  const signature = headersList.get("Upstash-Signature");

  if (!signature) {
    return new Response("No signature", { status: 401 });
  }

  const isValid = await receiver.verify({
    body: "",
    signature,
    url: process.env.WEBHOOK_URL!,
  });

  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const lengthOfQueue = await redis.llen("key");
  const lengthOfLoop = lengthOfQueue > 20 ? 20 : lengthOfQueue;
  for (let i = 0; i < lengthOfLoop; i++) {
    const email = await redis.lpop<string | null>("email");
    const password = await redis.lpop<string | null>("password");
    const id = await redis.lpop<string>("id");
    if (!email) break;

    const searchUser = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (searchUser.data.length > 0) {
      continue;
    } else {
      await clerkClient.users.createUser({
        emailAddress: [email],
        password: password === "null" ? undefined : password!,
        externalId: id!,
        skipPasswordRequirement: true,
        skipPasswordChecks: true,
      });
    }
  }
  console.log("BATCH IMPORTING WORKS");
  return new Response("OK", { status: 200 });
}

```

### 6. Migrate Data Access Patterns (/src/app/page.tsx)

Update all data access patterns to use Clerk's auth() instead of NextAuth's auth(). While the migration is happening, we will use the external_id (or use the patched auth helper) from clerk in order to retrieve data.

```diff
- import { auth } from "@/auth";
+ import { auth } from "@clerk/nextjs/server"

-  const session = await auth();
-  if (!session) return <div>Not Signed In</div>;

+ const { userId } : { userId: string | null } = await auth();
+ if (!userId) <div>Not Signed In</div>;

or

+ import { currentUser } from "@clerk/nextjs/server"
+ const user = await currentUser();
+ if(!user) <div>Not Signed In </div>;

```

#### Custom session claims

Our sessions allow for conditional expressions. This would allow you add a session claim that will return either the `externalId` (the previous id for your user) when it exists, or the `userId` from Clerk. This will result in your imported users returning their `externalId` while newer users will return the Clerk `userId`.

In your Dashboard, go to Sessions -> Edit. Add the following: 

```json
{
	"userId": "{{user.external_id || user.id}}"
}
```

You can now access this value using the following:
```ts 
const { sessionClaims } = auth();
console.log(sessionClaims.userId) 
```

You can add the following for typescript: 
```js
// types/global.d.ts

export { };

declare global {
  interface CustomJwtSessionClaims {
    userId?: string;
  }
}
```

**Side note, we're currently patching the clerk createUser function so that you can just set the userid as externalid instead of having to set external id, here's a patch to set the userid to externalId, once you can set userid on createUser, we can delete this and just reference userId**

We do this so that if 

```ts
// src/app/authPatch.ts

import { auth as ogAuth } from "@clerk/nextjs/server";
// this function sets the userId to the sessionClaims userId which
// is the externalId but if exteranal id is not set, it will be
// the clerk user id
// this is used to only use one key for the user_metadata table in db calls
export function auth() {
  const ogAuthRes = ogAuth();
  ogAuthRes.userId = ogAuthRes.sessionClaims!.userId! as string;
  console.log("NEW AUTH FUNCTION SET: ", ogAuthRes.userId);
  return ogAuthRes;
}

```

#### Here is an example of accessing the user metadata tenet tables with the new patterns (using the patched auth function)

```js
// src/app/page.tsx

import { auth, signOut } from "@/auth";
import { auth as authPatch } from "./authPatch";
import { db } from "@/server/neonDb";
import { userAttributes, users } from "@/server/neonDb/schema";
import { eq } from "drizzle-orm";

import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  const clerkUser = authPatch();
  if (session === null) {
    return redirect("/sign-in");
  }

  const userAttribute = await db.query.userAttributes.findFirst({
    where: eq(userAttributes.id, clerkUser.userId!),
  });

  return (
    <>
      <div>Signed In with Next-Auth</div>
      <div>{JSON.stringify(session)}</div>
      <div>Special Attribute: {userAttribute?.attribute}</div>
      <form
        action={async () => {
          "use server";
          await signOut();
        }}
      >
        <button type="submit">Sign Out</button>
      </form>
    </>
  );
}

```

#### We want users to edit their profile (attribute that are not classified as user metadata) in nextauth when they haven't been added to clerk yet, but if they are in clerk, we want them to edit profile information in clerk, this allows them to change profile information during the migration process

```js
// src/app/changePassword/page.tsx

import { auth as nextAuthFunction } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { auth } from "@clerk/nextjs/server";

import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

// checks if user is in clerk, if in clerk, change password in clerk (semantic user button)
// if not in clerk, change password in nextauth
export default async function Home() {
  const { userId }: { userId: string | null } = auth();
  const nexAuthUser = await nextAuthFunction();

  if (userId === null && nexAuthUser === null) {
    return redirect("/sign-in");
  }

  // if the user hasn't been migrated to clerk, change the password in nextauth
  if (userId === null) {
    return (
      <>
        <form
          action={async (formData) => {
            "use server";
            await db.update(users).set({
              password: formData.get("password") as string,
            });
          }}
        >
          <input type="password" name="password" />
          <button type="submit">Change Password</button>
        </form>
      </>
    );
  }

  // semantic representation of changing user profile in clerk
  return (
    <>
      <UserButton />
    </>
  );
}
```

#### Here is an example of accessing the user metadata through clerk's metadata

If you would like to store user metadata within Clerk's User object. Here is how you do it.

```js
// wherever you call createUser

await clerkClient.users.createUser({
  firstName: "Test",
  lastName: "User",
  emailAddress: [ "testclerk123@gmail.com" ],
  password: "password"
  public_metadata: {role: "Engineer"},
  private_metadata: {skillIssue: "can't center div"},
  unsafe_metadata: {status: "happy"}
})
```

```js
// where you choose to access user object

import { currentUser } from '@clerk/nextjs/server';

export default async function Page() {
  const user = await currentUser();

  if (!user) return <div>Not signed in</div>;

  return <div>Role {user?.publicMetadata.role}</div>;
}
```

## After the migration ('after-migration' branch)

Once all users are batched into clerk, we can switch the signups and sign ins to clerk! Since we signed in those who are already using the app, it will be a seamless switch!

### 7. Sign-Ups and Sign-Ins go through the clerk components

New user sign ups go through the clerk components.

```js
// src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { redirect } from "next/navigation";

export default function SignUpComponent() {
  const { userId }: { userId: string | null } = auth();
  if (userId === null) {
    return (
      <>
        <SignUp forceRedirectUrl={"/"} />
      </>
    );
  }

  return redirect("/");
}

// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { redirect } from "next/navigation";

export default async function SignInComponent() {
  const { userId }: { userId: string | null } = await auth();
  if (userId === null) {
    return (
      <>
        <SignIn forceRedirectUrl={"/"} />
      </>
    );
  }

  return redirect("/");
}
```

## Overview of migration flow

1. Add clerk middleware
2. Add <clerkProvider>
3. Trickle - allows users that are signed into next auth to be signed into clerk, we want this because when we flip the switch to using clerk, we don’t want the users to feel any change
    1. During the trickle, everybody still signs up and signs in through next auth, this prevents 
    2. Trickle, on client and wraps application, hits an endpoint, queries next auth information and then creates user, query can fail  which is suspended and returns children and has exponential backoff built in, this solves thundering heard
        1. If a user wants to change something in “user profiles” ie change profile / change password, on /changePasswords, the page checks if they are already in clerk
            1. If in clerk, change profile in clerk
            2. If not, change profile in next auth (once trickle hits, this allows them to have their profile information accurate and transferred
    3. Once query is successful, the sign in token is created and passed back to client, and on the client, the user is signed in
4. Batch import - this is for mass importing users from your entire users table to clerk, also does not have to start at the same time as the trickle to save bandwidth, we can wait for the thundering herd to be done and then start batch
    1. Put your entire user table into a queue
    2. A cron job calls /api/batch every 10 seconds which pops off 20 items of the queue, checks if they exist in clerk
        1. If not in clerk, Create user
        2. If in clerk, ignore’
5. Migrate all auth helper functions to use clerk’s auth helpers instead of next auth helpers

——— this line separates “migrating / after migration" branches, below this line happens after batch importing and trickle are done ———

1. Switch to clerk components
2. Remove trickle and batch code

## Wrapping Up
With your users now imported into Clerk and your application updated, you can fully switch to using Clerk for authentication. This guide provides a comprehensive approach to migrating from Next-Auth to Clerk with minimal disruption to