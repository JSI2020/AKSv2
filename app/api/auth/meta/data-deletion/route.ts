import { eraseProviderAccount } from "@/modules/legal/erase-customer";
import {
  handleMetaDataDeletion,
  liveMetaDeletionConfig,
} from "@/modules/legal/meta-deletion";

export const runtime = "nodejs";

/** Meta data-deletion callback. Facebook and Instagram post a signed_request. */
export function POST(request: Request) {
  return handleMetaDataDeletion(request, {
    ...liveMetaDeletionConfig(),
    erase: eraseProviderAccount,
  });
}
