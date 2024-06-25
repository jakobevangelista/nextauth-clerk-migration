"use client";

import { useSession, useSignIn, useUser } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function TrickleWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { signIn, setActive } = useSignIn();
  const { user } = useUser();
  const { session } = useSession();
  const [signInId, setSignInId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["token"],
    queryFn: async () => {
      const res = await fetch("/api/signInToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.status === 222) {
        return { token: "none" };
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const json = await res.json();
      //   console.log(json);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return json;
    },
    retry: (failureCount, error) => {
      console.log(error);
      const retryDelay = 1000 * 2 ** failureCount;
      setTimeout(() => {
        void queryClient.invalidateQueries();
      }, retryDelay);
      return true;
    },
  });

  useEffect(() => {
    // gets the token from query and signs the user in
    if (
      !signIn ||
      !setActive ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      session ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      query.data.token === "none" ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !query.data.token
    ) {
      return;
    }

    const createSignIn = async () => {
      if (!signIn || !setActive || signInId !== null) return;

      try {
        const res = await signIn.create({
          strategy: "ticket",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          ticket: query.data.token,
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
  }, [signIn, setActive, session, signInId, query.data]);

  return (
    <>
      <div>
        {user ? <div>USER CREATED: {user.id}</div> : null}
        {children}
      </div>
    </>
  );
}
