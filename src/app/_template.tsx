import { TrickleWrapper } from "nextauth-clerk-migration-package";

export default function Template({ children }: { children: React.ReactNode }) {
  return <TrickleWrapper>{children}</TrickleWrapper>;
}
