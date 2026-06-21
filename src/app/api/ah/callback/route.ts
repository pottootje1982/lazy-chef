import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { exchangeCode } from "@/lib/ah";
import { verifyState } from "@/lib/ah-state";

// Landing point for the AH OAuth code. AH only redirects to the native
// `appie://login-exit?code=…` scheme; a local handler (scripts/setup-ah-handler.sh)
// rewrites that to this URL and opens it in the browser. The connecting user is
// carried in the signed `state` param, so no session cookie is required here.

function page(status: number, title: string, body: string) {
  return new NextResponse(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title}</title>` +
      `<style>body{font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917;` +
      `display:grid;place-items:center;min-height:100vh;margin:0}` +
      `.card{max-width:24rem;padding:2rem;text-align:center}` +
      `a{color:#0d9488;font-weight:600}</style></head><body><div class="card">` +
      `<h1 style="font-size:1.25rem">${title}</h1><p>${body}</p>` +
      `<p><a href="/settings">&larr; Naar instellingen</a></p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code) {
    return page(400, "Geen code ontvangen", "De koppeling leverde geen inlogcode op. Probeer opnieuw vanaf Instellingen.");
  }
  const userId = state ? verifyState(state) : null;
  if (!userId) {
    return page(
      400,
      "Koppel-link verlopen",
      "Deze koppel-link is verlopen of ongeldig. Open Instellingen en start het koppelen opnieuw.",
    );
  }

  try {
    const { refreshToken } = await exchangeCode(code);
    await prisma.user.update({
      where: { id: userId },
      data: { ahAuthKey: encrypt(refreshToken), grocer: "ah" },
    });
  } catch {
    return page(
      400,
      "Koppelen mislukt",
      "Koppelen met Albert Heijn is mislukt. De code is mogelijk verlopen — probeer opnieuw.",
    );
  }

  return NextResponse.redirect(new URL("/settings?ah=connected", req.url));
}
