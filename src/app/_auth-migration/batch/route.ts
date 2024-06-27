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
