import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => res.cookies.set({ name, value, ...options }),
        remove: (name, options) => res.cookies.set({ name, value: '', ...options }),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = req.nextUrl.pathname;

  // ---- Rutas públicas (dejan pasar sin login)
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/img') ||            // 👈 permite tus imágenes del folder /public/img
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico';

  if (isPublic) {
    // Si ya estás logueada y visitas /login, mándate a tu portal
    if (pathname.startsWith('/login') && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role ?? 'student';
      const url = req.nextUrl.clone();
      url.pathname = role === 'professor' ? '/profesores' : '/estudiantes';
      return NextResponse.redirect(url);
    }
    return res;
  }

  // ---- Rutas protegidas
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Excluye estáticos de Next, pero OJO: /img no está aquí, por eso lo manejamos arriba con isPublic
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
