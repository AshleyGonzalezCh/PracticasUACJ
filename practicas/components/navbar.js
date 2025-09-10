import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  const [menuActive, setMenuActive] = useState(false);

  const toggleMenu = () => setMenuActive(!menuActive);

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

      {/* Botón de hamburguesa */}
      <div className="menu-toggle" onClick={toggleMenu}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className={`nav-links ${menuActive ? "active" : ""}`}>
        <a href="#"></a>
        <a href="#"></a>
        <a href="#">Vinculación</a>
        <a href="#">Iniciar Sesión</a>
      </div>
    </nav>
  );
}
