import { auth, clerkClient, type User } from "@clerk/nextjs/server";
import { type Session } from "next-auth";
// import { oldCheckHasSession, oldGetUserData } from "./helpers";
export const dynamic = "force-dynamic";

// prolly need to import these types from clerk, ask colin about
// exporting these types
type UserMetadataParams = {
  publicMetadata?: UserPublicMetadata;
  privateMetadata?: UserPrivateMetadata;
  unsafeMetadata?: UserUnsafeMetadata;
};
type PasswordHasher =
  | "argon2i"
  | "argon2id"
  | "bcrypt"
  | "bcrypt_sha256_django"
  | "md5"
  | "pbkdf2_sha256"
  | "pbkdf2_sha256_django"
  | "pbkdf2_sha1"
  | "phpass"
  | "scrypt_firebase"
  | "scrypt_werkzeug"
  | "sha256";
type UserPasswordHashingParams = {
  passwordDigest: string;
  passwordHasher: PasswordHasher;
};
export type CreateUserParams = {
  externalId?: string;
  emailAddress?: string[];
  phoneNumber?: string[];
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  skipPasswordChecks?: boolean;
  skipPasswordRequirement?: boolean;
  totpSecret?: string;
  backupCodes?: string[];
  createdAt?: Date;
} & UserMetadataParams &
  (UserPasswordHashingParams | object);

export function createMigrationHandler({
  oldCheckHasSession,
  oldGetUserData,
}: {
  oldCheckHasSession: () => Promise<Session | null>;
  oldGetUserData: () => Promise<CreateUserParams>;
}) {
  return async function udontknowthepainittooktomakethishappen() {
    const session = await oldCheckHasSession();
    const { userId }: { userId: string | null } = auth();

    if (userId) return new Response("User already exists", { status: 222 });
    if (!session?.user?.email)
      return new Response("User not signed into next auth", { status: 222 });

    let createdUser: User | null | undefined = null;

    try {
      const user = await oldGetUserData();

      if (!user) throw new Error("User not found");
      createdUser = await clerkClient.users.createUser(user);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (e.errors[0].message as string).includes("That email address is taken")
      ) {
        // checks for user email already existing (inserted from batch import)
        const searchUser = await clerkClient.users.getUserList({
          emailAddress: [session.user.email],
        });
        createdUser = searchUser.data[0];
      }
    }

    if (!createdUser) throw new Error("User not created");

    // creates sign in token for user
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const signInToken: { token: string } = await fetch(
      "https://api.clerk.com/v1/sign_in_tokens",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          user_id: createdUser.id,
        }),
      }
    ).then(async (res) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await res.json();
    });

    if (!signInToken.token) throw new Error("Sign in token not created");

    return new Response(JSON.stringify({ token: signInToken.token }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };
}
