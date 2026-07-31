// Next.js 16 の proxy（旧 middleware）— Supabase セッションの更新とルート保護
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /api/cron はセッションを持たない Vercel Cron から叩かれる。
// ルート側で CRON_SECRET を検証するため、ここでの /login リダイレクト対象から除外する。
const PUBLIC_PATHS = ["/login", "/setup", "/api/cron"];

export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 環境未設定の場合はセットアップ案内のみ表示可能にする
  if (!url || !anonKey) {
    if (request.nextUrl.pathname === "/") return NextResponse.next();
    return NextResponse.redirect(new URL("/", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // セッション更新（期限切れトークンのリフレッシュ）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic && path !== "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && (path === "/login" || path === "/")) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
