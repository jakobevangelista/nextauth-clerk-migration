import { signIn } from "@/auth";
import { SignIn } from "@clerk/nextjs";

export default function NextAuthGoogleSignIn() {
  return (
    <>
      <div>NextAuthGoogleSignIn</div>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button type="submit">Signin with Google</button>
      </form>
      <SignIn />
    </>
  );
}
