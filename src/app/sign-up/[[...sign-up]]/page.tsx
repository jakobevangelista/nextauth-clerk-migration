import { auth } from "@/auth";
import { db } from "@/server/neonDb";
import { users } from "@/server/neonDb/schema";

import { redirect } from "next/navigation";

export default async function SignUp() {
  const session = await auth();
  if (!session) {
    return (
      <>
        <form
          action={async (formData) => {
            "use server";
            try {
              await db.insert(users).values({
                email: formData.get("email")! as string,
                password: formData.get("password")! as string,
              });
              redirect("/sign-in");
            } catch (error) {
              throw error;
            }
          }}
        >
          <label>
            Email
            <input className="text-black" name="email" type="email" />
          </label>
          <label>
            Password
            <input className="text-black" name="password" type="password" />
          </label>
          <button>Sign Up with Credentials</button>
        </form>
      </>
    );
  }

  return redirect("/");
}
