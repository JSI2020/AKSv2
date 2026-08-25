export { encryptSecret, decryptSecret } from "./encryption";
export {
  OTP_LENGTH,
  OTP_TTL_MS,
  hashOtp,
  generateOtpCode,
  normalizeEmail,
  issueEmailOtp,
  verifyEmailOtp,
  consumeEmailOtp,
} from "./otp";
export {
  checkOtpRequestRateLimit,
  checkOtpVerifyRateLimit,
  checkBankReceiptRateLimit,
  OTP_EMAIL_LIMIT,
  OTP_IP_LIMIT,
  OTP_VERIFY_LIMIT,
} from "./rate-limit";
export { logSignInAttempt } from "./attempts";
export {
  createAuthSession,
  getActiveSession,
  touchSession,
  revokeSession,
  listUserSessions,
  parseDevice,
  clientIpFromHeaders,
} from "./sessions";
export {
  rolesRequiring2fa,
  beginTotpEnrolment,
  confirmTotpEnrolment,
  verifyTotpForUser,
  consumeRecoveryCode,
} from "./totp";
export { handleEmailSend } from "./email-handler";
export type { EmailSendPayload } from "./email-handler";
export {
  requirePermission,
  getPermissionsForUser,
  userHasPermission,
  PermissionDeniedError,
  UnauthenticatedError,
  setUserPermissionEffect,
  clearUserPermissionEffect,
  permissionIdsByKeys,
  can,
  resolvePermissions,
} from "./rbac";
// Client hooks live in `./use-can` — import that path from client components.
// Re-exporting them here pulls server auth (next/headers) into the client bundle.
export { deleteSomethingAction } from "./actions";
