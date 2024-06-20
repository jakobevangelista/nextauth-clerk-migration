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

1. **Add Clerk Middleware and Nest Next-Auth Middleware**
2. **Switch Data Access Patterns to Clerk**
3. **Implement User Creation and Sign-In with Clerk**
4. **Batch Import Existing Users**
5. **Turn Off Next-Auth**

## Migration Steps

### 1. Add Clerk Middleware (/src/app/middleware.ts)

We need Clerk's middleware in order to use useSign in.

First, add the Clerk middleware alongside the existing NextAuth middleware. Clerk middleware has to be the top wrapper for the entire middleware. In the example provided, we put a sample middleware functions within the next auth middleware, you can switch this with whatever middleware custom middleware functions you have.


```js
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);
const nextAuthMiddle = auth(function middleware(req) {
  // custom middleware functions here
});

export default clerkMiddleware(async (clerkauth, req) => {
  console.log("MIDDLE WARE WORK CLERK");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await nextAuthMiddle(req); // works but needs AppRouteHandlerFnContext
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### 2. Migrate Data Access Patterns (/src/app/page.tsx)

<!-- need to implement code example with diffs graphic -->

Update all data access patterns to use Clerk's auth() instead of NextAuth's auth().

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

#### Here is an example

```js
import { db } from "@/server/neonDb";
import { userAttributes, users } from "@/server/neonDb/schema";
import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { redirect } from "next/navigation";

export default async function Home() {
  const user = await currentUser();
  if (user === null) {
    return redirect("/sign-in");
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.email, user.emailAddresses[0]?.emailAddress!),
  });

  const userAttribute = await db.query.userAttributes.findFirst({
    where: eq(userAttributes.userId, dbUser?.id!),
  });

  return (
    <>
      <div>Special Attribute: {userAttribute?.attribute}</div>
      <UserButton />
    </>
  );
}
```


### 3. Trickle Migration

Use the following code to create users in Clerk and sign them in, this auto signs users in that were previously signed into nextauth allowing zero-downtime sign in:

#### Server-Side (/src/app/_components/migrationComponent.tsx)

    Create a server-side function that checks if the current NextAuth user exists in Clerk. If not, create the user in Clerk, generate a sign-in token, and pass it to the frontend. This implementation uses Nextjs App router's server component, but you can do this traditionally by making this an api endpoint that you call from the frontend.

    We are using the "external_id" attribute within the createUser function. This allows users to have a tenet table to store all user attributes outside of clerk in their own user table.

    We query the tenet table and pass the data to the children as an example of how to use the external_id function.


```js
import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { auth as clerkAuthFunction, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import ClientClerkcomponent from "./clientClerkComponent";

export default async function MigrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const { userId }: { userId: string | null } = clerkAuthFunction();
  if (userId) return <>{children}</>;
  if (!session?.user) return <>{children}</>;

  // checks for user email already existing (inserted from batch import)
  const searchUser = await clerkClient.users.getUserList({
    emailAddress: [session.user.email!],
  });

  let createdUser = null;

  if (searchUser.data.length > 0) {
    createdUser = searchUser.data[0];
  } else {
    if (!session.user.email) return <div>Failed to create user in clerk</div>;
    const user = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
    });

    if (!user) return <div>Failed to find user create user in db</div>;
    // creates user in clerk, with password if it exists, and externalId as the user id
    // to access tenet table attributes
    createdUser = await clerkClient.users.createUser({
      emailAddress: [session.user.email],
      password: user.password ?? undefined,
      skipPasswordChecks: true,
      externalId: `${user.id}`,
    });
  }

  if (!createdUser) return <div>Failed to create user</div>;

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

  if (!signInToken.token) return <div>Failed to create sign in token</div>;

  return (
    <>
      <ClientClerkcomponent sessionId={signInToken.token} />
      {children}
    </>
  );
}

```

#### Client Side Component (/src/app/_components/clientClerkComponent.tsx)

On the frontend, use the token to sign the user into Clerk seamlessly.

We also display the information retrieved from the tenet table.


```js
"use client";

import { useSignIn, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

interface ClientClerkComponentProps {
  sessionId: string;
}

export default function ClientClerkComponent({
  sessionId,
}: ClientClerkComponentProps) {
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();
  const [signInProcessed, setSignInProcessed] = useState<boolean>(false);

  useEffect(() => {
    // magic link method to sign in using token
    // instead of passing to url, passed from server
    if (!signIn || !setActive || !sessionId) {
      return;
    }

    const createSignIn = async () => {
      try {
        const res = await signIn.create({
          strategy: "ticket",
          ticket: sessionId,
        });

        console.log("RES: ", res);
        await setActive({
          session: res.createdSessionId,
          beforeEmit: () => setSignInProcessed(true),
        });
      } catch (err) {
        setSignInProcessed(true);
      }
    };

    void createSignIn();
  }, [signIn, setActive, sessionId]);

  if (!sessionId) {
    return <div>no token provided</div>;
  }

  if (!signInProcessed) {
    return <div>loading</div>;
  }

  if (!user) {
    return <div>error invalid token {sessionId}</div>;
  }

  return (
    <>
      <div>Signed in as {user.id}</div>
    </>
  );
}
```

### 4. Wrap Application in <ClerkProvider> and <MigrationLayout> (/src/app/layout.tsx)

Wrap your application layout in the <ClerkProvider> component to enable Clerk authentication. Also wrap the <MigrationLayout> component, this allows users that are already signed into next-auth to seamlessly sign into clerk.

```js
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import MigrationLayout from "./_components/migrationComponent";

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
          <MigrationLayout>{children}</MigrationLayout>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### 5. Batch Import

The batch import handles the migration of inactive users through a scheduled process, ensuring all users are migrated without overwhelming the system.

#### Script to get all users in existing database within a queue (/src/app/batch/page.tsx)

Store all users in a queue for batch processing. This can be done using a standalone nodejs script. The implementation uses nextjs app router's server components. 

The process is just iterating through all the users, storing them in a queue for the cron job to process individually. Definitely scaling concerns but you can modify this solution to fit your scale.

```js
import { db } from "@/server/db";
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

#### Backend API for Batch Import to import users into Clerk (/src/app/api/batch)

Use a cron job to process the queue and create users in Clerk, respecting rate limits. Using Upstash for the cron job running but you can use any job runner of your choice. Again, does not have to be in nextjs, can be any express-like backend. 

```js
import { clerkClient } from "@clerk/nextjs/server";
import { Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
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

    const searchUser = await clerkClient.users.getUserList({ emailAddress: [email] });

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
### 6. Handling users that need to sign in during migration (/src/app/sign-in/[[...sign-in]]/page.tsx) and (/src/app/api/trickle2/route.ts)

There is a case where registered users need to sign in during the migration and they haven't have yet been added to clerk through the batch import. To solve this, we have a script is added to the sign in page in order to add those users into clerk as well as sign them in with their already existing information. It calls to an api point in /api/trickle2 that facilitates the inserting of the user to clerk.

#### Here is the script that runs on sign in (/src/app/sign-in/[[...sign-in]]/page.tsx):
```js
"use client";
import { redirect } from "next/navigation";
import { auth as clerkAuthFunction } from "@clerk/nextjs/server";
import { SignIn, useUser } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignInComponent() {
  //   const session = await auth();
  const { user } = useUser();
  useEffect(() => {
    const origFetch = window.fetch;
    window.fetch = async function (url, init) {
      const originalRes = await origFetch(url, init);

      if (originalRes.status === 422) {
        const res = await fetch("/api/trickle2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: init?.body,
          }),
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await res.json();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (data.error === "not exist") {
          return originalRes;
        } else {
          const retry = await origFetch(url, init);
          return retry;
        }
      }

      return originalRes;
    };
    return () => {
      window.fetch = origFetch;
    };
  });
  if (user === null || user === undefined) {
    return (
      <>
        <SignIn forceRedirectUrl={"/"} />
      </>
    );
  }

  return redirect("/");
}
```
#### This is the api point that the script calls (/src/app/api/trickle2/route.ts) 
```js
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest, res: NextResponse) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  console.log("REQ BODY: ", body);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const onlyEmail = decodeURIComponent(body.email.split("=")[1]);
  const user = await db.query.users.findFirst({
    where: eq(users.email, onlyEmail),
  });
  if (!user) {
    return Response.json({ error: "not exist" });
  }

  await clerkClient.users.createUser({
    emailAddress: [onlyEmail],
    password: user.password ?? undefined,
    skipPasswordChecks: true,
    externalId: `${user.id}`,
  });

  return Response.json({ succes: "user exists" });
};

```

### 7. Sign Ups go through the clerk component

New user sign ups go through the clerk components, nothing too special here.

```js
import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { redirect } from "next/navigation";

export default async function SignUpComponent() {
  const { userId }: { userId: string | null } = await auth();
  if (userId === null) {
    return (
      <>
        <SignUp forceRedirectUrl={"/"} />
      </>
    );
  }

  return redirect("/");
}
```

## How migrations flow works
<!-- I am unsure how much we should hand hold the migrator -->
1. Migrate all auth helper functions to use clerk's auth function ie clerk's auth() and/or currentUser().
2. Batch import and trickle migration
    - While this is going on, users will sign in through clerk. The sign in component has a special effect that runs that adds the user to clerk if they haven't already migrated during the batch import.
3. New users sign up with clerk components
4. Once the batch import is finished and all users are imported into clerk, you can delete the sign in script, it's api points, and the batch import api point

## Wrapping Up
With your users now imported into Clerk and your application updated, you can fully switch to using Clerk for authentication. This guide provides a comprehensive approach to migrating from Next-Auth to Clerk with minimal disruption to