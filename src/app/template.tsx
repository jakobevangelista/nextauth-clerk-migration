import TrickleWrapper from "./tricklerWrapper";

export default function Tempalate({ children }: { children: React.ReactNode }) {
  return <TrickleWrapper>{children}</TrickleWrapper>;
}
