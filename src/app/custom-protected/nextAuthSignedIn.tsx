import { auth } from "@/auth";
import { auth as clerkAuth } from "@clerk/nextjs/server";

export default async function NextAuthSignedIn({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const { userId }: { userId: string | null } = clerkAuth();

  if (session === null || userId !== null) {
    return null;
  }

  return <>{children}</>;
}
