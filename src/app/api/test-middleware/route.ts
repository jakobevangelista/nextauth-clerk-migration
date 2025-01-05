import { NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest, res: NextResponse) => {
  console.log("hit the test route");
  return new NextResponse("done", { status: 200 });
};
