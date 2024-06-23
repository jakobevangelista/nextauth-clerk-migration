# Migration Guide: Moving from Next-Auth to Clerk 

## Introduction

Migrating from Next-Auth to Clerk can be daunting, but this guide aims to help you achieve a seamless transition with zero downtime. This guide covers running both middlewares simultaneously, importing users while keeping your application active, and ensuring a smooth experience for your users.

## Prerequisites

Before you begin, ensure you have the following:

- An active Clerk account.
- Your current application using Next-Auth.
- Access to your user database.
(We're assuming all user data outside of user name, email, and password are stored in a tenet table (ie user_attribute table) with a foreign key that is the next-auth user primary key, definitely lots of holes with this assumption)

## Migration Overview

To ensure a smooth migration with minimal disruption to your users, we will follow these steps:
1. **Batch Import Existing Users**
2. **Add Clerk Middleware and Nest Next-Auth Middleware**
3. **Implement Trickle Migration**
4. **Implement Sign-up and Sign-in with Clerk**
5. **Switch Data Access Patterns to Clerk**
6. **Turn off all next-auth things and switch to clerk**

## Migration Steps


### 1. Add Clerk Middleware

We need Clerk's middleware in order to use useSign in.

First, add the Clerk middleware alongside the existing NextAuth middleware. Clerk middleware has to be the top wrapper for the entire middleware. In the example provided, we put a sample middleware functions within the next auth middleware, you can switch this with whatever middleware custom middleware functions you have.


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

### 2. Wrap Application in &lt;ClerkProvider> and &lt;MigrationLayout> and &lt;QueryClient>

Wrap your application layout in the &lt;ClerkProvider> component to enable Clerk authentication. Also wrap the &lt;MigrationLayout> component, this allows users that are already signed into next-auth to seamlessly sign into clerk.

If using react query, wrap your application in query client, follow react query docs for more information.

```js
// src/app/layout.tsx

```

### 3. Trickle Migration

<!-- Users need to add clerkprovider in order for this to work so we can somehow fit it into the docs later -->

Use the following code to create users in Clerk and sign them in, this auto signs users in that were previously signed into nextauth allowing zero-downtime sign in:

#### Server-Side

Create a server-side function that checks if the current NextAuth user exists in Clerk. If not, create the user in Clerk, generate a sign-in token, and pass it to the frontend.

We are using the "external_id" attribute within the createUser function. This allows users to have a tenet table to store all user attributes outside of clerk in their own user table.

(When we change the api, we can tell them they can set userid instead of setting external id)


```js
// src/app/_components/migrationComponent.tsx

```

#### Client Side Component

On the frontend, use the token to sign the user into Clerk seamlessly.

We also display the information retrieved from the tenet table.


```js
// src/app/_components/clientClerkComponent.tsx

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

### 4. Batch Import

The batch import handles the migration of all users through a scheduled process, ensuring all users are migrated without overwhelming the system and hitting the rate limit (20req/10sec). We do this by limiting batch importing to 15req/10sec to allow the trickle migration to have some for its processing. (After v1, we want this to go as fast as possible with an exponential backoff in order to not have to manually keep track)

#### Script to get all users in existing database within a queue

Store all users in a queue for batch processing. This can be done using a standalone nodejs script. The implementation uses nextjs app router's server components. 

The process is just iterating through all the users, storing them in a queue for the cron job to process individually. Definitely scaling concerns but you can modify this solution to fit your scale.

As with the trickle migration, along with creating the user in clerk, we also want to update the user attribute table associated with the migrated user.

```js
// src/app/batch/page.tsx
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

#### Backend API for Batch Import to import users into Clerk

Use a cron job to process the queue and create users in Clerk, respecting rate limits. Using Upstash for the cron job running but you can use any job runner of your choice. Again, does not have to be in nextjs, can be any express-like backend. 

```js
// src/app/api/batch/route.ts

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
      const createdUser = await clerkClient.users.createUser({
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
### 5. Migrate Data Access Patterns (/src/app/page.tsx)

<!-- need to implement code example with diffs graphic -->

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

#### Here is an example of accessing the tenet tables with the new patterns

```js
// src/app/page.tsx

```

### 6. Sign-Ups and Sign-Ins go through the clerk components

New user sign ups go through the clerk components

```js
// src/app/sign-up/[[...sign-up]]/page.tsx
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

// src/app/sign-in/[[...sign-i]]/page.tsx
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


### 7. Switch all instances of next auth with clerk after batch import rate falls below rate limit

Flip the switch and everything is ok.

## Overview of migration flow
<!-- I am unsure how much we should hand hold the migrator -->

1. Add clerk middleware
2. Add <clerkProvider>
3. Trickle - allows users that are signed into next auth to be signed into clerk, we want this because when we flip the switch to using clerk, we don’t want the users to feel any change
    1. During the trickle, everybody still signs up and signs in through next auth, this prevents 
    2. Trickle, on client and wraps application, hits an endpoint, with react query, that queries next auth information and then creates user, query can fail  which is suspended and returns children and has exponential backoff built in(react query but make sure the retry length is infinite and not just 30 seconds, or let the user know it stops exponentially trying after 30 second interval), this solves thundering hear
        1. If a user wants to change something in “user profiles” ie change profile / change password, on /changePasswords, the page checks if they are already in clerk
            1. If in clerk, change profile in clerk
            2. If not, change profile in next auth (once trickle hits, this allows them to have their profile information accurate and transfered
    3. Once query is successful, the sign in token is created and passed back to client, and on the client, the user is signed in
4. Batch import - this is for mass importing users from your entire users table to clerk, also does not have to start at the same time as the trickle to save bandwidth, we can wait for the thundering herd to be done and then start batch
    1. Put your entire user table into a queue
    2. A cron job calls /api/batch every 10 seconds which pops off 20 items of the queue, checks if they exist in clerk
        1. If not in clerk, Create user
        2. If in clerk, ignore’
In both trickle and batch, make sure to mention that for user metadata, there are 2 ways to store information, tenet (separate) table with a foreign key of either externalid/userid, or use clerk metadata
	- show how to do both
	- also show how im editing the userid to be user.sessionclaims.userid
	and why its bad dx

——— this line separates “migrating / finished migrating” branches, below this line happens after batch importing and trickle are done ———

1. Migrate all auth helper functions to use clerk’s auth helpers instead of next auth helpers
2. Switch from clerk sign
3. Remove trickle and batch code

## Wrapping Up
With your users now imported into Clerk and your application updated, you can fully switch to using Clerk for authentication. This guide provides a comprehensive approach to migrating from Next-Auth to Clerk with minimal disruption to