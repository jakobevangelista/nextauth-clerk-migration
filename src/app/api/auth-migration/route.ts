import {
  oldCheckHasSession,
  oldGetUserData,
} from "@/app/_auth-migration/helpers";
import { createMigrationHandler } from "@/app/_auth-migration/routeHelper";
import { createAPIHandler } from "./deezroutereal";

export const dynamic = "force-dynamic";

export const POST = createMigrationHandler({
  oldCheckHasSession,
  oldGetUserData,
});

// export const POST = createAPIHandler({
//   oldCheckHasSession,
//   oldGetUserData,
// });
