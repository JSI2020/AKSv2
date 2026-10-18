"use server";

import { createHash, randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import {
  db,
  insertAuditLog,
  permissions,
  sessions,
  staffInvites,
  userPermissions,
  users,
  type Database,
} from "@aks/db";
import {
  isPermissionKey,
  uuidv7,
  type StaffRole,
} from "@aks/shared";
import { enqueue } from "@/modules/platform/outbox";
import {
  clearUserPermissionEffect,
  clientIpFromHeaders,
  listUserSessions,
  normalizeEmail,
  requirePermission,
  revokeSession,
  setUserPermissionEffect,
} from "@/modules/auth";

import { INVITABLE_ROLES, STAFF_ROLES } from "./roles";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

async function auditContext() {
  const h = await headers();
  return {
    ip: clientIpFromHeaders(h),
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}

function assertCanAssignRole(actorRole: string, targetRole: StaffRole) {
  if (targetRole === "OWNER" && actorRole !== "OWNER") {
    throw new Error("Only an OWNER can assign the OWNER role");
  }
  if (targetRole === "ADMIN" && actorRole !== "OWNER") {
    throw new Error("Only an OWNER can assign the ADMIN role");
  }
}

export async function inviteStaffAction(
  formData: FormData,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("staff.create");
    const email = normalizeEmail(String(formData.get("email") ?? ""));
    const nameRaw = String(formData.get("name") ?? "").trim();
    const roleRaw = String(formData.get("role") ?? "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Valid email required" };
    }
    if (
      !isStaffRole(roleRaw) ||
      !(INVITABLE_ROLES as readonly string[]).includes(roleRaw)
    ) {
      return { ok: false, error: "Invalid role" };
    }

    assertCanAssignRole(session.user.role, roleRaw);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return { ok: false, error: "A user with that email already exists" };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(token);
    const userId = uuidv7();
    const inviteId = uuidv7();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const ctx = await auditContext();
    const appUrl =
      process.env.AUTH_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const loginUrl = `${appUrl}/admin/login?email=${encodeURIComponent(email)}`;

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        name: nameRaw || null,
        role: roleRaw,
        status: "INVITED",
      });

      await tx.insert(staffInvites).values({
        id: inviteId,
        email,
        role: roleRaw,
        tokenHash,
        invitedById: session.user.id,
        status: "PENDING",
        expiresAt,
      });

      await enqueue(
        "email.send",
        {
          to: email,
          subject: "You're invited to AKS admin",
          text: `You've been invited to the AKS admin portal as ${roleRaw}. Sign in at ${loginUrl} with a one-time code sent to this email.`,
          html: `<p>You've been invited to the AKS admin portal as <strong>${roleRaw}</strong>.</p><p><a href="${loginUrl}">Sign in</a> with a one-time code sent to this email.</p>`,
        },
        tx,
      );

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "staff.invite",
        entityType: "user",
        entityId: userId,
        before: null,
        after: { email, role: roleRaw, status: "INVITED", inviteId },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    return { ok: true, userId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invite failed";
    return { ok: false, error: message };
  }
}

export async function updateStaffRoleAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("staff.edit");
    const userId = String(formData.get("userId") ?? "");
    const roleRaw = String(formData.get("role") ?? "");

    if (!userId || !isStaffRole(roleRaw)) {
      return { ok: false, error: "Invalid input" };
    }

    assertCanAssignRole(session.user.role, roleRaw);

    const [target] = await db
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) return { ok: false, error: "User not found" };
    if (target.role === "OWNER" && roleRaw !== "OWNER") {
      return { ok: false, error: "Cannot demote the OWNER" };
    }
    if (target.id === session.user.id && roleRaw !== target.role) {
      return { ok: false, error: "Cannot change your own role" };
    }

    const ctx = await auditContext();
    const before = { role: target.role };

    await db
      .update(users)
      .set({ role: roleRaw, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "staff.assign_role",
      entityType: "user",
      entityId: userId,
      before,
      after: { role: roleRaw },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: message };
  }
}

export async function setPermissionOverrideAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("staff.assign_permissions");
    const userId = String(formData.get("userId") ?? "");
    const keyRaw = String(formData.get("key") ?? "");
    const effectRaw = String(formData.get("effect") ?? "");

    if (!userId || !isPermissionKey(keyRaw)) {
      return { ok: false, error: "Invalid input" };
    }
    if (
      effectRaw !== "GRANT" &&
      effectRaw !== "DENY" &&
      effectRaw !== "INHERIT"
    ) {
      return { ok: false, error: "Invalid effect" };
    }

    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) return { ok: false, error: "User not found" };
    if (target.role === "OWNER") {
      return { ok: false, error: "Cannot override OWNER permissions" };
    }

    const beforeRows = await db
      .select({
        key: permissions.key,
        effect: userPermissions.effect,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(
        and(eq(userPermissions.userId, userId), eq(permissions.key, keyRaw)),
      )
      .limit(1);

    const before = beforeRows[0]
      ? { key: beforeRows[0].key, effect: beforeRows[0].effect }
      : { key: keyRaw, effect: "INHERIT" };

    if (effectRaw === "INHERIT") {
      await clearUserPermissionEffect({ userId, key: keyRaw });
    } else {
      await setUserPermissionEffect({
        userId,
        key: keyRaw,
        effect: effectRaw,
        id: uuidv7(),
      });
    }

    const ctx = await auditContext();
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "staff.assign_permissions",
      entityType: "user",
      entityId: userId,
      before,
      after: { key: keyRaw, effect: effectRaw },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: message };
  }
}

export async function deactivateStaffAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("staff.deactivate");
    const userId = String(formData.get("userId") ?? "");
    if (!userId) return { ok: false, error: "Invalid input" };
    if (userId === session.user.id) {
      return { ok: false, error: "Cannot deactivate yourself" };
    }

    const [target] = await db
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target) return { ok: false, error: "User not found" };
    if (target.role === "OWNER") {
      return { ok: false, error: "Cannot deactivate the OWNER" };
    }

    const ctx = await auditContext();
    const before = { status: target.status };

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: "DISABLED", updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx.delete(sessions).where(eq(sessions.userId, userId));

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "staff.deactivate",
        entityType: "user",
        entityId: userId,
        before,
        after: { status: "DISABLED" },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deactivate failed";
    return { ok: false, error: message };
  }
}

export async function revokeStaffSessionAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("staff.edit");
    const userId = String(formData.get("userId") ?? "");
    const sessionId = String(formData.get("sessionId") ?? "");
    if (!userId || !sessionId) {
      return { ok: false, error: "Invalid input" };
    }

    const rows = await listUserSessions(userId);
    const target = rows.find((s) => s.id === sessionId);
    if (!target) return { ok: false, error: "Session not found" };

    await revokeSession(sessionId);

    const ctx = await auditContext();
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "staff.revoke_session",
      entityType: "session",
      entityId: sessionId,
      before: {
        userId,
        device: target.device,
        ip: target.ip,
        lastSeenAt: target.lastSeenAt,
      },
      after: null,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Revoke failed";
    return { ok: false, error: message };
  }
}
