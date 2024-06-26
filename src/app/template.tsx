import TrickleWrapper from "./trickleWrapper";

export default function Tempalate({ children }: { children: React.ReactNode }) {
  return <TrickleWrapper>{children}</TrickleWrapper>;
}
