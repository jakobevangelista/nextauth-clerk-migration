"use client";

import { useSignIn, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

interface ClientClerkComponentProps {
  sessionId: string;
}

export default function ClientClerkComponent({
  sessionId,
}: ClientClerkComponentProps) {
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();
  const [signInProcessed, setSignInProcessed] = useState<boolean>(false);

  useEffect(() => {
    // magic link method to sign in using token
    // instead of passing to url, passed from server
    if (!signIn || !setActive || !sessionId) {
      return;
    }

    const createSignIn = async () => {
      try {
        const res = await signIn.create({
          strategy: "ticket",
          ticket: sessionId,
        });

        console.log("RES: ", res);
        await setActive({
          session: res.createdSessionId,
          beforeEmit: () => setSignInProcessed(true),
        });
      } catch (err) {
        setSignInProcessed(true);
      }
    };

    void createSignIn();
  }, [signIn, setActive, sessionId]);

  if (!sessionId) {
    return <div>no token provided</div>;
  }

  if (!signInProcessed) {
    return <div>loading</div>;
  }

  if (!user) {
    return <div>error invalid token {sessionId}</div>;
  }

  return (
    <>
      <div>Signed in Clerk {user.id}</div>
    </>
  );
}
