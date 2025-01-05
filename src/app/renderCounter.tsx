"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";

export default function RenderCounter() {
  //   const [count, setCount] = useState(0);
  useEffect(() => {
    // console.log("Rendered");
    // const origFetch = window.fetch;
    // window.fetch = async (url, init) => {
    //   const originalRes = await origFetch(url, init);

    //   console.log("fetch intercepted", originalRes);
    //   return originalRes;
    // };

    // return () => {
    //   window.fetch = origFetch;
    // };
    console.log("origFetch");
  });
  return (
    <>
      <RenderCounterComponent />
      {/* <RenderCounterComponent setCount={setCount} count={count} /> */}
    </>
  );
}

function RenderCounterComponent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button
        onClick={async () => {
          const res = await fetch("https://randomuser.me/api/");
          console.log("RES: ", res);
          setCount(count + 1);
          console.log("Clicked");
        }}
      >
        Increment
      </button>
    </>
  );
}
