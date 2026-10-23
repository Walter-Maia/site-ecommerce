import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_S, cookieOptions } from "@/server/auth/cookie-config";

/**
 * 1) CSP estrita com nonce por requisição (o Next lê o nonce do cabeçalho da
 *    requisição e aplica nos próprios scripts). Exige renderização dinâmica.
 * 2) Redirecionamento OTIMISTA de /conta e /admin sem cookie de sessão. A
 *    verificação real (requireUser/requireAdmin) acontece em cada página e ação.
 * 3) Expiração deslizante do cookie de sessão em navegações GET.
 */

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React aplica atributos style inline; nonce em style-src anularia o 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function isProtected(pathname: string) {
  return pathname === "/conta" || pathname.startsWith("/conta/") || pathname === "/admin" || pathname.startsWith("/admin/");
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const { pathname, search } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = !!session && TOKEN_RE.test(session);

  if (!hasSession && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Só em GET: em POST (Server Actions) o login/logout gravam o próprio cookie
  // e um Set-Cookie do proxy poderia sobrescrever o logout.
  if (hasSession && request.method === "GET") {
    response.cookies.set(SESSION_COOKIE, session, cookieOptions(SESSION_TTL_S));
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|images/|favicon\\.ico|icon\\.svg|icon\\.png|apple-icon).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
