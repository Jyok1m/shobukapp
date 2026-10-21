import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "shobukapp_session";

/*
 * Optimistic check only: no cookie at all means no session, so redirect before
 * rendering. A present cookie is validated by the layouts through /auth/me.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/connexion", request.url));
}

export const config = {
  matcher: [
    "/tableau-de-bord/:path*",
    "/profil/:path*",
    "/abonnement/:path*",
    "/annuaire/:path*",
    "/messagerie/:path*",
    "/documents/:path*",
    "/licences/:path*",
    "/admin/:path*",
    "/admin",
  ],
};
