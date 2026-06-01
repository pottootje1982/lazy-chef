"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { startLogin, verify2FA } from "@/lib/picnic";

export type PicnicConnectState = {
  step: "credentials" | "2fa";
  error?: string;
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function picnicConnect(
  _prev: PicnicConnectState | undefined,
  formData: FormData,
): Promise<PicnicConnectState> {
  const userId = await requireUserId();
  const code = (formData.get("code") as string | null)?.trim();

  let outcome;
  if (code) {
    // Verify step: reconstruct the login session from the stored interim key.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { picnicPendingKey: true },
    });
    if (!user?.picnicPendingKey) {
      return { step: "credentials", error: "Your verification session expired. Start again." };
    }
    outcome = await verify2FA(decrypt(user.picnicPendingKey), code);
  } else {
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const password = (formData.get("password") as string | null) ?? "";
    if (!email || !password) {
      return { step: "credentials", error: "Email and password are required." };
    }
    outcome = await startLogin(email, password);
  }

  if (outcome.status === "linked") {
    await prisma.user.update({
      where: { id: userId },
      data: { picnicAuthKey: encrypt(outcome.authKey), picnicPendingKey: null },
    });
    revalidatePath("/settings");
    redirect("/settings");
  }

  if (outcome.status === "2fa_required") {
    // Persist the interim key so the verify request (possibly a different
    // serverless instance) can reconstruct the session.
    await prisma.user.update({
      where: { id: userId },
      data: { picnicPendingKey: encrypt(outcome.pendingKey) },
    });
    return { step: "2fa" };
  }

  return { step: code ? "2fa" : "credentials", error: outcome.message };
}

export async function picnicUnlink(): Promise<void> {
  const userId = await requireUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { picnicAuthKey: null, picnicPendingKey: null },
  });
  revalidatePath("/settings");
}
