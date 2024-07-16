import { signIn } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest, res: NextResponse) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await req.json();
  console.log("BODY: ", body);
  await signIn("credentials", {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    email: body.email,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    password: body.password,
  });
  return new Response(JSON.stringify({ deez: "nuts" }), { status: 200 });
};
