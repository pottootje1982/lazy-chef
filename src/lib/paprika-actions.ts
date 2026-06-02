"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { verifyCredentials } from "@/lib/paprika";

export type PaprikaConnectState = { error?: string };

async function requireNonGuest(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isGuest) redirect("/settings");
  return session.user.id;
}

export async function paprikaConnect(
  _prev: PaprikaConnectState | undefined,
  formData: FormData,
): Promise<PaprikaConnectState> {
  const userId = await requireNonGuest();
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  if (!email || !password) return { error: "Email and password are required." };

  try {
    await verifyCredentials(email, password);
  } catch {
    return { error: "Could not sign in to Paprika — check your email and password." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { paprikaEmail: email, paprikaPassword: encrypt(password) },
  });
  revalidatePath("/settings");
  redirect("/settings");
}

export async function paprikaDisconnect(): Promise<void> {
  const userId = await requireNonGuest();
  await prisma.user.update({
    where: { id: userId },
    data: { paprikaEmail: null, paprikaPassword: null },
  });
  revalidatePath("/settings");
}
