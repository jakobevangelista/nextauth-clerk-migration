// src/app/api/batch/route.ts

import { oldGetUserById } from "@/app/_auth-migration/sampleHelpers";
import { clerkClient } from "@clerk/nextjs/server";
import { Receiver } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import pRetry, { AbortError } from "p-retry";

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

  const lengthOfQueue = await redis.llen(process.env.CLERK_SECRET_KEY!);
  const lengthOfLoop = lengthOfQueue > 20 ? 20 : lengthOfQueue;
  for (let i = 0; i < lengthOfLoop; i++) {
    const id = await redis.lpop<string>(process.env.CLERK_SECRET_KEY!);

    const user = await oldGetUserById(id!);

    await pRetry(
      async () => {
        try {
          await clerkClient.users.createUser(user);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (e.errors[0].message as string).includes(
              "That email address is taken"
            )
          ) {
            throw new AbortError("User already exists");
          } else {
            throw new Error("User not created");
          }
        }
      },
      { retries: 100 }
    );
  }
  return new Response("OK", { status: 200 });
}
