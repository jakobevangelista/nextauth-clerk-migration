export async function POST(req: Request) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const rand = Math.random();
  console.log("RAND: ", rand);
  //   if (rand > 0.1) {
  //     console.log("500 error");
  //     return new Response("Error", {
  //       status: 400,
  //     });
  //   }

  return new Response(
    JSON.stringify({ message: "This response was delayed by 2 seconds" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  //   return new Response(JSON.stringify({ message: "Hello from the API" }), {
  //     status: 200,
  //   });
  //   if (Math.random() > 0.5) {
  //     return new Response(JSON.stringify({ message: "Hello from the API" }), {
  //       status: 200,
  //     });
  //   }

  //   return new Response(JSON.stringify({ message: "Hello from the API" }), {
  //     status: 500,
  //   });
}
