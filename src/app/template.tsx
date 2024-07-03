// import TrickleWrapper from "./_auth-migration/trickleWrapper";
import { auth, TrickleWrapper } from "nextauth-clerk-migration-package";

export default function Tempalate({ children }: { children: React.ReactNode }) {
  return <TrickleWrapper>{children}</TrickleWrapper>;
}
