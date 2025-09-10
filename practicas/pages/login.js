import { useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from '../components/navbar';
import Footer from '../components/footer';
import { supabase } from '../lib/supabaseClient';

const allowed = ['uacj.mx', 'alumnos.uacj.mx'];
const isInstitutional = (email) =>
  allowed.some((d) => email.trim().toLowerCase().endsWith('@' + d));

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    if (!isInstitutional(email)) {
      setErr('Usa tu correo institucional (@uacj.mx o @alumnos.uacj.mx).');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr('No se pudo obtener el usuario.'); return; }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();

    const role = (profile && profile.role) ? profile.role : 'student';
    router.replace(role === 'professor' ? '/profesores' : '/estudiantes');
  };

  const onReset = async () => {
    if (!email) { setErr('Escribe tu correo para enviarte el enlace de recuperación.'); return; }
    if (!isInstitutional(email)) { setErr('El correo debe ser institucional.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) setErr(error.message);
    else alert('Te enviamos un correo para reestablecer tu contraseña.');
  };

  return (
    <>
      <Navbar />
      <main className="login-wrap">
        <div className="login-card">
          {/* Panel izquierdo (azul) */}
          <div className="login-left">
            {/* <img src="/img/login-left.png" alt="UACJ patrón" /> */}
          </div>

          {/* Panel derecho (formulario) */}
          <div className="login-right">
            <h2>INICIAR SESIÓN</h2>

            <form onSubmit={onSubmit} className="login-form">
              <input
                className="login-input"
                type="email"
                placeholder="Correo electrónico institucional"
                value={email}
                onChange={e=>setEmail(e.target.value)}
                required
              />
              <input
                className="login-input"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                required
              />

              {err && <p className="login-error">{err}</p>}

              <button className="login-btn" disabled={loading}>
                {loading ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>

            <button className="login-forgot" type="button" onClick={onReset}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
