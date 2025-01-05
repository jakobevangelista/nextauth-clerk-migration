import {
  oldCheckHasSession,
  oldGetUserData,
} from "@/app/_auth-migration/sampleHelpers";
// import { createMigrationHandler } from "nextauth-clerk-migration-package";
import { createMigrationHandler } from "@/app/_auth-migration/routeHelper";

export const POST = createMigrationHandler({
  oldCheckHasSession,
  oldGetUserData,
});
