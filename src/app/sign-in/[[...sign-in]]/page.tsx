import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { redirect } from "next/navigation";

export default function SignInComponent() {
  const { userId }: { userId: string | null } = auth();
  if (userId === null) {
    return (
      <>
        <SignIn forceRedirectUrl={"/"} />
      </>
    );
  }

  return redirect("/");
}
