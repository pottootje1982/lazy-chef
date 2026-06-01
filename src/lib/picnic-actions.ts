"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
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
    outcome = await verify2FA(userId, code);
  } else {
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const password = (formData.get("password") as string | null) ?? "";
    if (!email || !password) {
      return { step: "credentials", error: "Email and password are required." };
    }
    outcome = await startLogin(userId, email, password);
  }

  if (outcome.status === "linked") {
    await prisma.user.update({
      where: { id: userId },
      data: { picnicAuthKey: encrypt(outcome.authKey) },
    });
    revalidatePath("/settings");
    redirect("/settings");
  }

  if (outcome.status === "2fa_required") {
    return { step: "2fa" };
  }

  return { step: code ? "2fa" : "credentials", error: outcome.message };
}

export async function picnicUnlink(): Promise<void> {
  const userId = await requireUserId();
  await prisma.user.update({ where: { id: userId }, data: { picnicAuthKey: null } });
  revalidatePath("/settings");
}
