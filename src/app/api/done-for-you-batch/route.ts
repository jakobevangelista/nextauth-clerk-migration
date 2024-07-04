import { getAllUsers } from "@/app/_auth-migration/sampleHelpers";
import { createQueueApiPoint } from "nextauth-clerk-migration-package";

export const GET = createQueueApiPoint({
  getAllUserIds: getAllUsers,
  secret: process.env.CLERK_SECRET_KEY!,
  apiPoint: process.env.INTERNAL_QUEUE_LINK!,
});
