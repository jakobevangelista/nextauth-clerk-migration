import { UserButton } from "@clerk/nextjs";
import ClerkSignedIn from "./clerkSignedIn";
import NextAuthSignedIn from "./nextAuthSignedIn";
import { signOut } from "@/auth";

export default function CustomProtected() {
  return (
    <>
      <div>CustomProtected</div>

      <ClerkSignedIn>
        <UserButton />
      </ClerkSignedIn>
      <NextAuthSignedIn>
        <form
          action={async () => {
            "use server";
            await signOut();
            //   redirect("/custome-clerk-sign-in");
          }}
        >
          <button type="submit">Sign Out</button>
        </form>
      </NextAuthSignedIn>
    </>
  );
}
