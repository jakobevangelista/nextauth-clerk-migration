import { auth } from "@clerk/nextjs/server";

export default function ClerkSignedIn({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId }: { userId: string | null } = auth();

  if (userId === null) {
    return null;
  }

  return <>{children}</>;
}
