export default function BigBatch() {
  return (
    <>
      <div>BigBatch</div>
      <form
        action={async () => {
          "use server";

          await fetch("http://localhost:3000/api/big-batch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({ deeznuts: "deeznuts" }),
          });
        }}
      >
        <button type="submit">Submit</button>
      </form>
    </>
  );
}
