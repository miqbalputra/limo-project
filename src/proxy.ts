import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "limo_session";

const dashboardPrefixes = ["/admin", "/guru", "/wali", "/siswa", "/ubah-password"];

const exemptApiPrefixes = [
  "/api/health",
  "/api/internal/",
  "/api/v1/auth/",
  "/api/v1/public/",
  "/api/v1/pendaftaran",
  "/api/v1/webhooks/",
];

function isExemptApi(pathname: string) {
  return exemptApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (hasSessionCookie || isExemptApi(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sesi tidak ditemukan" } },
      { status: 401 },
    );
  }

  if (dashboardPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/guru/:path*",
    "/wali/:path*",
    "/siswa/:path*",
    "/ubah-password",
    "/api/:path*",
  ],
};
