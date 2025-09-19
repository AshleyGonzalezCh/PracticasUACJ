// middleware.js
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

  // ---- Redirección legacy: /estudiantes -> /alumno/buscar
  if (pathname === '/estudiantes') {
    const url = req.nextUrl.clone();
    url.pathname = '/alumno/buscar';
    return NextResponse.redirect(url);
  }

  // ---- Rutas públicas (dejan pasar sin login)
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/img') ||            // Para poder utilizar las img sin logearse
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico';

  if (isPublic) {
    // Si se pica al login estando ya logeado te manda al portal, ojito plebe
    if (pathname.startsWith('/login') && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role ?? 'student';
      const url = req.nextUrl.clone();
      url.pathname = role === 'professor' ? '/profesores' : '/alumno/buscar'; // <<< aquí cambiamos
      return NextResponse.redirect(url);
    }
    return res;
  }

  // Rutas protegidas
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Excluye estáticos de Next
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
