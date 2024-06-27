import TrickleWrapper from "./_auth-migration/trickleWrapper";

export default function Tempalate({ children }: { children: React.ReactNode }) {
  return <TrickleWrapper>{children}</TrickleWrapper>;
}
