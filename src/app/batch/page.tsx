import { db } from "@/server/neonDb";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default function Batch() {
  async function buttonPress() {
    "use server";
    console.log("In action");
    const users = await db.query.users.findMany({
      columns: {
        id: true,
      },
    });
    console.log("USERS: ", users);

    await fetch("http://localhost:3000/api/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
      body: JSON.stringify(users),
    });
    console.log("pressed");
    // for (const user of users) {
    // await redis.rpush("email", user.email);
    //   await redis.rpush("password", user.password ?? "null");
    //   await redis.rpush("id", user.id);
    //   console.log("IMPORTED: ", user.email);
    // }
  }
  return (
    <>
      <form action={buttonPress}>
        <button>Press me</button>
      </form>
    </>
  );
}
