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

  useEffect(() => {
    console.log("here");
    // gets the token from query and signs the user in
    if (
      !signIn ||
      !setActive ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      session ||
      signInId !== null
    ) {
      return;
    }

    if (!fetchRan.current) {
      const createSignIn = async () => {
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

        let data = null;

        if (res.status === 222) {
          data = { token: "none" };
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data = await res.json();
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (data.token === "none") {
          return;
        }

        try {
          const res = await signIn.create({
            strategy: "ticket",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            ticket: data.token,
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

      return (): void => {
        fetchRan.current = true;
      };
    }
  }, [signIn, setActive, session, signInId]);

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

/*
 *
React 19+
You might notice we are using a useRef in order to prevent a second effect ran in strictmode, a common thing react does. 
You can find more information [here](https://github.com/facebook/react/issues/24670), [here](https://github.com/reactjs/react.dev/issues/6123), 
and [here](https://github.com/reactjs/react.dev/pull/6777). The only reason this ever worked is because "refs not mounted/un-mounted in strict 
mode" was a known bug since 2022, and it is getting fixed in React 19.

In the react-query-migrating, there is an implementation using react query. And in the server-component-migrating branch, there is an implementation 
using server components. No need for scary useEffects 
 *
 */
