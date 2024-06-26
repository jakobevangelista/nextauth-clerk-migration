"use client";

import { UserButton, useSession, useSignIn, useUser } from "@clerk/nextjs";
import pRetry from "p-retry";
import { useEffect, useRef, useState } from "react";

export default function TrickleWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();
  const { session } = useSession();
  const fetchRan = useRef<boolean>(false);
  const [signInId, setSignInId] = useState<string | null>(null);
  const [signInToken, setSignInToken] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchRan.current) {
      if (signInToken !== null || signInId !== null) return;

      const myFetch = async () => {
        // await fetch("/api/hitTheLimit", {
        //   method: "GET",
        //   headers: {
        //     "Content-Type": "application/json",
        //   },
        // });
        const res = await pRetry(
          async () => {
            const res = await fetch("/api/auth-migration", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (!res.ok) {
              throw new Error(res.statusText);
            }
            return res;
          },
          {
            retries: 100,
            onFailedAttempt: (error) => {
              console.log(`Attempt ${error.attemptNumber} failed.`);
            },
          }
        );

        if (res.status === 222) {
          setSignInToken("none");
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        setSignInToken(data.token);
      };
      void myFetch();
    }
    return (): void => {
      fetchRan.current = true;
    };
  }, [signInToken, signInId]);

  useEffect(() => {
    // gets the token from query and signs the user in
    if (
      !signIn ||
      !setActive ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      session ||
      signInId !== null ||
      signInToken === null ||
      signInToken === "none"
    ) {
      return;
    }

    const createSignIn = async () => {
      if (
        !signIn ||
        !setActive ||
        signInId !== null ||
        signInToken === null ||
        signInToken === "none"
      )
        return;

      try {
        const res = await signIn.create({
          strategy: "ticket",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          ticket: signInToken,
        });

        setSignInId(res.createdSessionId);

        void setActive({
          session: res.createdSessionId,
        });
      } catch (error) {
        console.log("ERROR: ", error);
      }
    };

    void createSignIn();
  }, [signIn, setActive, session, signInId, signInToken]);

  return (
    <>
      <div>
        {user ? <div>USER CREATED: {user.id}</div> : null}
        <UserButton />
        {children}
      </div>
    </>
  );
}
