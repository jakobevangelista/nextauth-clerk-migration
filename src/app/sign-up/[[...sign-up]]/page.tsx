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
