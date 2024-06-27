import { auth as ogAuth } from "@clerk/nextjs/server";
// this function sets the userId to the sessionClaims userId which
// is the externalId but if exteranal id is not set, it will be
// the clerk user id
// this is used to only use one key for the user_metadata table in db calls
export function auth() {
  const ogAuthRes = ogAuth();
  if (!ogAuthRes.userId) {
    return null;
  }
  ogAuthRes.userId = ogAuthRes.sessionClaims.userId! as string;
  // console.log("NEW AUTH FUNCTION SET: ", ogAuthRes.userId);
  return ogAuthRes;
}
