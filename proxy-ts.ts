import { NextRequest, NextResponse } from "next/server";

// Protege /admin com Basic Auth. Defina ADMIN_USER e ADMIN_PASSWORD no .env
export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  // Sem credenciais configuradas, bloqueia tudo (falha segura)
  if (!user || !pass) {
    return new NextResponse("Admin não configurado.", { status: 503 });
  }

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const index = decoded.indexOf(":");
      const u = decoded.slice(0, index);
      const p = decoded.slice(index + 1);

      if (u === user && p === pass) {
        return NextResponse.next();
      }
    } catch {
      // credencial malformada: cai no 401
    }
  }

  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Street77 Admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};