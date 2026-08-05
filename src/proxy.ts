import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookieName } from "@/server/env";

const dashboardPrefixes = ["/admin", "/guru", "/wali", "/siswa"];
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(getSessionCookieName())?.value);

  if (dashboardPrefixes.some((prefix) => pathname.startsWith(prefix)) && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/guru/:path*", "/wali/:path*", "/siswa/:path*", "/login", "/lupa-password", "/reset-password"],
};
