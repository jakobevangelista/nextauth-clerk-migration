import { auth, signIn, signOut } from "@/auth";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export default async function SignIn() {
  const session = await auth();
  if (session === null) {
    return (
      <>
        <form
          action={async (formData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/",
              });
              console.log("Signed In");
            } catch (error) {
              console.log("ERROR");
              if (error instanceof AuthError) {
                switch (error.message) {
                  case "CredentialsSignIn":
                    return { error: "Invalid credentials" };
                  default:
                    return { error: "An error occurred" };
                }
              }
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
          <button>Sign In with Credentials</button>
        </form>
      </>
    );
  }

  return redirect("/");
}
