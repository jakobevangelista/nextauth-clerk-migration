import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function CustomNextAuthProtected() {
  const session = await auth();
  if (session === null) {
    return redirect("/custom-clerk-sign-in");
  }
  return (
    <>
      <div>CustomNextAuthProtected</div>
      <form
        action={async () => {
          "use server";
          await signOut();
          //   redirect("/custome-clerk-sign-in");
        }}
      >
        <button type="submit">Sign Out</button>
      </form>
    </>
  );
}
