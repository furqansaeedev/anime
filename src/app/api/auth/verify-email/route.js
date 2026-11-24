import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";

function getLoginUrl(appUrl, params) {
  const loginUrl = new URL("/login", appUrl);

  for (const [key, value] of Object.entries(params)) {
    loginUrl.searchParams.set(key, value);
  }

  return loginUrl;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  try {
    const appUrl = getAppUrl();

    if (!token) {
      return NextResponse.redirect(
        getLoginUrl(appUrl, { error: "missing_token" })
      );
    }

    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return NextResponse.redirect(
        getLoginUrl(appUrl, { error: "invalid_token" })
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return NextResponse.redirect(
      getLoginUrl(appUrl, { verified: "true" })
    );
  } catch (error) {
    console.error("Email Verification Error:", error);

    // Use the incoming request's origin as a fallback for this error redirect.
    const appUrl = new URL(request.url).origin;

    return NextResponse.redirect(
      getLoginUrl(appUrl, { error: "server_error" })
    );
  }
}