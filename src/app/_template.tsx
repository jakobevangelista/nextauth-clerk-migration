// import { TrickleWrapper } from "nextauth-clerk-migration-package";

import LayoutTrickleWrapper from "./_auth-migration/layoutTrickleWrapper";
import TrickleWrapper from "./_auth-migration/trickleWrapper";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LayoutTrickleWrapper />
      {children}
    </>
  );
}
