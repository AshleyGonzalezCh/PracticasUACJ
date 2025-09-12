// components/Navbar.js
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Navbar() {
  const router = useRouter();
  const pathname = router.pathname;

  // ¿área portal?
  const isPortal =
    pathname.startsWith("/estudiantes") || pathname.startsWith("/mis-practicas");

  // Home: menú hamburguesa
  const [menuActive, setMenuActive] = useState(false);
  const toggleMenu = () => setMenuActive((s) => !s);

  // Portal: usuario + menú
  const [userName, setUserName] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const menuRef = useRef(null);

  // Portal: menú móvil (usamos MISMA clase .menu-toggle que el nav principal)
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const togglePortalMenu = () => setPortalMenuOpen((s) => !s);

  useEffect(() => {
    let ignore = false;
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (!ignore && profile?.full_name) setUserName(profile.full_name);
    };
    if (isPortal) loadUser();
    return () => { ignore = true; };
  }, [isPortal]);

  const abrirMenu = () => { setClosing(false); setUserOpen(true); };
  const cerrarMenu = () => {
    if (!userOpen && !closing) return;
    setClosing(true);
    setTimeout(() => { setUserOpen(false); setClosing(false); }, 250);
  };
  const toggleUser = () => {
    if (userOpen && !closing) cerrarMenu();
    else if (!userOpen && !closing) abrirMenu();
  };

  // click fuera / ESC para menú de usuario
  useEffect(() => {
    if (!userOpen && !closing) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) cerrarMenu();
    };
    const onEsc = (e) => { if (e.key === "Escape") cerrarMenu(); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [userOpen, closing]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ---------- NAVBAR HOME ----------
  if (!isPortal) {
    return (
      <nav className="navbar">
        <div className="nav-logo-text">
          <Link href="/">
            <Image
              src="/img/uacj.png"
              alt="Logo UACJ"
              width={60}
              height={60}
              priority
            />
          </Link>
        </div>

        <div className={`menu-toggle ${menuActive ? "active" : ""}`} onClick={toggleMenu}>
          <span></span><span></span><span></span>
        </div>


        <div className={`nav-links ${menuActive ? "active" : ""}`}>
          <a className="nav-text" href="#">Vinculación</a>
          <Link className="nav-text" href="/login">Iniciar Sesión</Link>
        </div>
      </nav>
    );
  }

 // ---------- NAVBAR PORTAL (tabs + usuario) ----------

const [userEmail, setUserEmail] = useState("");
const esActiva = (p) => pathname === p || pathname.startsWith(p + "/");

// cargar nombre y email (ya cargabas full_name)
useEffect(() => {
  let ignore = false;
  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (!ignore) {
      if (profile?.full_name) setUserName(profile.full_name);
      setUserEmail(user.email || "");
    }
  };
  if (isPortal) loadUser();
  return () => { ignore = true; };
}, [isPortal]);

return (
  <>
    <header className="nav-portal">
      <div className="barra">
        <div className="izquierda">
          <Link href="/" className="marca">
            <Image
              src="/img/uacj.png"
              alt="UACJ"
              width={60}
              height={60}
              priority
            />
          </Link>

          <nav className="tabs">
            <Link
              href="/estudiantes"
              className={`tab ${esActiva("/estudiantes") ? "activa" : ""}`}
              aria-current={esActiva("/estudiantes") ? "page" : undefined}
            >
              BUSCAR
            </Link>
            <Link
              href="/mis-practicas"
              className={`tab ${esActiva("/mis-practicas") ? "activa" : ""}`}
              aria-current={esActiva("/mis-practicas") ? "page" : undefined}
            >
              MIS PRÁCTICAS
            </Link>
          </nav>
        </div>

        <div className="derecha">
          <div
            className={`menu-toggle portal ${portalMenuOpen ? "active" : ""}`}
            onClick={togglePortalMenu}
            aria-label="Abrir menú"
            aria-expanded={portalMenuOpen ? "true" : "false"}
          >
            <span></span><span></span><span></span>
          </div>

          <button className="btn-usuario" onClick={toggleUser}>
            {/* En desktop se ve; en móvil se oculta por CSS */}
            <span className="usuario-nombre">{userName}</span>
            <div className="usuario-avatar" aria-hidden />
            <svg className={`caret ${userOpen ? "abierto" : ""}`} width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M7 10l5 5 5-5z" />
            </svg>
          </button>

          {(userOpen || closing) && (
            <div
              ref={menuRef}
              className={`menu-usuario ${closing ? "cerrando" : (userOpen ? "abierto" : "")}`}
            >
              {/* Header de cuenta dentro del menú (nombre/email siempre visibles aquí) */}
              <div className="cuenta">
                <div className="avatar" aria-hidden />
                <div className="datos">
                  <span className="nombre">{userName}</span>
                  {userEmail ? <span className="email">{userEmail}</span> : null}
                </div>
              </div>

              <button className="menu-item" onClick={logout}>Cerrar sesión</button>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Menú móvil del portal (drawer simple) */}
    <div className={`portal-links ${portalMenuOpen ? "active" : ""}`}>
      <Link
        href="/estudiantes"
        className={`portal-link ${esActiva("/estudiantes") ? "activa" : ""}`}
        onClick={() => setPortalMenuOpen(false)}
      >
        BUSCAR
      </Link>
      <Link
        href="/mis-practicas"
        className={`portal-link ${esActiva("/mis-practicas") ? "activa" : ""}`}
        onClick={() => setPortalMenuOpen(false)}
      >
        MIS PRÁCTICAS
      </Link>
    </div>
  </>
);

}
