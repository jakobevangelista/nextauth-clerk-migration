import { clerkClient } from "@clerk/nextjs/server";

export const GET = async () => {
  for (let i = 0; i < 30; i++) {
    console.log("Creating user");
    await clerkClient.users.createUser({
      emailAddress: [`${Math.random()}@gmail.com`],
      skipPasswordRequirement: true,
      skipPasswordChecks: true,
    });
  }
};
