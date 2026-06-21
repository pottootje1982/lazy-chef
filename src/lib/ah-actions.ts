"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { extractAuthCode, exchangeCode } from "@/lib/ah";

async function writerId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.isGuest) return null;
  return session.user.id;
}

export type AhConnectState = { error?: string } | undefined;

// Finish the AH OAuth flow: the user logged in at login.ah.nl and pasted the
// resulting code (or the full appie://login-exit?code=… redirect URL). Exchange
// it for tokens and store the refresh token (encrypted). Also makes AH active.
export async function ahConnect(
  _prev: AhConnectState,
  formData: FormData,
): Promise<AhConnectState> {
  const userId = await writerId();
  const t = await getTranslations("settings");
  if (!userId) return { error: t("ahConnectError") };

  const code = extractAuthCode(String(formData.get("code") ?? ""));
  if (!code) return { error: t("ahCodeMissing") };

  try {
    const { refreshToken } = await exchangeCode(code);
    await prisma.user.update({
      where: { id: userId },
      data: { ahAuthKey: encrypt(refreshToken), grocer: "ah" },
    });
  } catch {
    return { error: t("ahConnectError") };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return undefined;
}

export async function ahUnlink(): Promise<void> {
  const userId = await writerId();
  if (!userId) return;
  await prisma.user.update({ where: { id: userId }, data: { ahAuthKey: null } });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
