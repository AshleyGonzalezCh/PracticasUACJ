// components/StudentNavbar.js
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function StudentNavbar({ userEmail = 'Estudiante Ejemplo' }) {
  const router = useRouter();
  const isTab = (p) => router.pathname === p;

  return (
    <header className="stu-nav">
      <div className="stu-nav__bar">
        <div className="stu-nav__left">
          <Link href="/" className="stu-nav__brand">
            <img src="/img/uacj_logo_nav.svg" alt="UACJ" />
          </Link>

          <nav className="stu-nav__tabs">
            <Link href="/estudiantes" className={`stu-nav__tab ${isTab('/estudiantes') ? 'is-active' : ''}`}>
              BUSCAR
            </Link>
            <Link href="/mis-practicas" className="stu-nav__tab">
              MIS PRÁCTICAS
            </Link>
          </nav>
        </div>

        <div className="stu-nav__right">
          <span className="stu-nav__user">{userEmail}</span>
          <div className="stu-nav__avatar" aria-hidden />
        </div>
      </div>
    </header>
  );
}
