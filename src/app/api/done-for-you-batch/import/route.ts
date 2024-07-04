import { oldGetUserById } from "@/app/_auth-migration/sampleHelpers";
import { type NextRequest } from "next/server";
import { createBatchImportHandler } from "nextauth-clerk-migration-package";

export const POST = (req: NextRequest) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  createBatchImportHandler(req, oldGetUserById);
