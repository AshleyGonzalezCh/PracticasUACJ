// pages/alumno/ofertas.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/navbar";
import Footer from "../../components/footer";

/* ---------- Mini UI ---------- */
function Stars({ rating = 0, compact = false }) {
  const r = Math.round(Number(rating || 0));
  return (
    <span className={`jobs-stars ${compact ? "small" : ""}`} aria-label={`Calificación ${r} de 5`}>
      <span className="full">{"★★★★★".slice(0, r)}</span>
      <span className="empty">{"★★★★★".slice(r)}</span>
    </span>
  );
}
function LogoSquare({ src }) {
  if (!src) return <div className="jobs-logo-fallback" aria-hidden />;
  return (
    <div className="jobs-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}
function splitLines(text) {
  const arr = String(text || "")
    .split(/\r?\n|•|- /)
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : ["No disponible"];
}
const fmtMod = (m) => (m === "presencial" ? "Presencial" : m === "remoto" ? "Remota" : "Híbrida");
const fmtComp = (c) => c || "Compensación N/A";

/* ---------- Página ---------- */
export default function OfertasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [userId, setUserId] = useState(null);
  const [hasActivePractice, setHasActivePractice] = useState(false);

  // Solo ofertas del alumno
  const [offers, setOffers] = useState([]); // [{appId, applied_at, vacancy{...}}]
  const [selected, setSelected] = useState(null);

  const isMobile = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        setUserId(user.id);

        // ¿ya tiene práctica activa?
        const { data: prac } = await supabase
          .from("practices")
          .select("student_id")
          .eq("student_id", user.id)
          .maybeSingle();
        if (!ignore) setHasActivePractice(!!prac);

        // Ofertas
        const { data, error } = await supabase
          .from("applications")
          .select(`
            id, applied_at, status,
            vacancy:vacancies (
              id, title, modality, compensation, language,
              location_text, rating_avg, rating_count, created_at,
              company:companies ( id, name, logo_url )
            )
          `)
          .eq("student_id", user.id)
          .eq("status", "oferta")
          .order("applied_at", { ascending: false });

        if (error) throw error;

        const list = (data || [])
          .filter(r => !!r?.vacancy)
          .map(r => ({ appId: r.id, applied_at: r.applied_at, status: r.status, ...r.vacancy }));

        if (!ignore) {
          setOffers(list);
          setSelected(list[0] || null);
        }
      } catch (e) {
        if (!ignore) setErr(e.message || "No se pudieron cargar tus ofertas.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [router]);

  const acceptOffer = async (appId) => {
    if (!userId || !appId) return;
    if (hasActivePractice) {
      alert("Ya tienes una práctica activa. No puedes aceptar otra.");
      return;
    }
    try {
      // Si tienes el RPC:
      const { error } = await supabase.rpc("student_accept_offer", { p_app_id: appId });
      if (error) throw error;

      // UI: saca esta oferta y redirige a mis-prácticas
      setOffers(prev => prev.filter(o => o.appId !== appId));
      router.push("/alumno/mis-practicas");
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo aceptar la oferta.");
    }
  };

  const declineOffer = async (appId) => {
    if (!userId || !appId) return;
    const ok = confirm("¿Rechazar esta oferta? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      // Si tienes un RPC student_decline_offer, úsalo. Si no, fallback:
      const { error } = await supabase
        .from("applications")
        .update({ status: "rechazada", decision: "declined", decision_at: new Date().toISOString() })
        .eq("id", appId);
      if (error) throw error;

      setOffers(prev => prev.filter(o => o.appId !== appId));
      if (selected?.appId === appId) setSelected(null);
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo rechazar la oferta.");
    }
  };

  const list = useMemo(() => offers, [offers]);

  return (
    <>
      <Navbar />

      <main className="jobs-wrap">
        {err && <div className="jobs-error">{err}</div>}

        {/* Aviso si ya tiene práctica activa */}
        {hasActivePractice && (
          <div className="jobs-error" style={{ background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}>
            Ya tienes una práctica activa. No puedes aceptar otra oferta por ahora.
          </div>
        )}

        <h2 style={{ textAlign: "center", margin: "6px 0 12px" }}>Mis ofertas</h2>

        {/* Grid principal: lista + detalle (como en buscar/mis-prácticas) */}
        <section className="jobs-grid">
          <aside className="jobs-listing">
            {loading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="jobs-card sk" />)}
            {!loading && list.length === 0 && (
              <div className="jobs-empty small">No tienes ofertas por el momento.</div>
            )}

            {!loading && list.map((v) => (
              <button
                key={v.appId}
                className={`jobs-card ${selected?.appId === v.appId ? "is-active" : ""}`}
                onClick={() => {
                  if (isMobile()) {
                    // en móvil puedes llevar a detalle de vacante si quieres
                    // pero aquí mantenemos la UX en esta página
                    setSelected(v);
                  } else {
                    setSelected(v);
                }}}
              >
                <div className="jobs-card-left" />
                <div className="jobs-card-body">
                  <div className="jobs-card-top" style={{ justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <LogoSquare src={v.company?.logo_url} />
                      <div>
                        <h4 className="jobs-card-title">{v.title}</h4>
                        <div className="jobs-card-company">{v.company?.name || "Empresa"}</div>
                        <div className="jobs-card-rating">
                          <Stars rating={v.rating_avg} compact />
                          <span className="jobs-muted small">({v.rating_count ?? 0})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="jobs-meta">
                    <span>{fmtMod(v.modality)}</span>
                    <span>{fmtComp(v.compensation)}</span>
                    <span>Idioma {v.language || "ES"}</span>
                  </div>

                  <div className="jobs-loc-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M12 2A7 7 0 0 0 5 9c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
                      />
                    </svg>
                    <span className="jobs-muted">{v.location_text || "Ubicación no especificada"}</span>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="jobs-apply"
                      onClick={(e) => { e.stopPropagation(); acceptOffer(v.appId); }}
                      disabled={hasActivePractice}
                      title={hasActivePractice ? "Ya tienes una práctica activa" : "Aceptar oferta"}
                    >
                      Aceptar oferta
                    </button>
                    <button
                      className="jobs-apply"
                      style={{ background: "#e9eef6", color: "#1f2937" }}
                      onClick={(e) => { e.stopPropagation(); declineOffer(v.appId); }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </aside>

          {/* Detalle (sticky en desktop) */}
          <article className="jobs-detail">
            {loading && <div className="jobs-skeleton">Cargando…</div>}
            {!loading && !selected && list.length > 0 && <div className="jobs-empty">Selecciona una oferta.</div>}

            {!loading && selected && (
              <div className="jobs-detail-inner">
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h2 className="jobs-title">{selected.title}</h2>
                    <a className="jobs-company" href="#" onClick={(e) => e.preventDefault()}>
                      {selected.company?.name || "Empresa"}
                    </a>
                    <div className="jobs-rating">
                      <Stars rating={selected.rating_avg} />
                      <span className="jobs-muted">({selected.rating_count ?? 0})</span>
                    </div>
                  </div>
                </header>

                <div className="jobs-chips">
                  <span className="jobs-chip">{fmtMod(selected.modality)}</span>
                  <span className="jobs-chip">{fmtComp(selected.compensation)}</span>
                  <span className="jobs-chip">Idioma {selected.language || "ES"}</span>
                </div>

                <p className="jobs-location">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M12 2A7 7 0 0 0 5 9c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
                    />
                  </svg>
                  {selected.location_text || "Ubicación no especificada"}
                </p>

                <hr className="jobs-sep" />

                {selected.activities && (
                  <section className="jobs-section">
                    <h3>Actividades</h3>
                    <ul className="jobs-list">
                      {splitLines(selected.activities).map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </section>
                )}
                {selected.requirements && (
                  <section className="jobs-section">
                    <h3>Requisitos</h3>
                    <ul className="jobs-list">
                      {splitLines(selected.requirements).map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </section>
                )}

                <div className="jobs-cta" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    className="jobs-apply"
                    onClick={() => acceptOffer(selected.appId)}
                    disabled={hasActivePractice}
                    title={hasActivePractice ? "Ya tienes una práctica activa" : "Aceptar oferta"}
                  >
                    Aceptar oferta
                  </button>
                  <button
                    className="jobs-apply"
                    style={{ background: "#e9eef6", color: "#1f2937" }}
                    onClick={() => declineOffer(selected.appId)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )}
          </article>
        </section>
      </main>

      <Footer />
    </>
  );
}
