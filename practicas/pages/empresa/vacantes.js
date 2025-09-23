// pages/empresa/vacantes.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/navbar";
import Footer from "../../components/footer";

export default function EmpresaVacantesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  const [company, setCompany] = useState(null);
  const [vacancies, setVacancies] = useState([]);
  const [selectedVac, setSelectedVac] = useState(null);

  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);

  const reqSeq = useRef(0);
  const router = useRouter();

  useEffect(() => {
    let ignore = false;

    const boot = async () => {
      try {
        setLoading(true);
        setErr("");

        // 0) Usuario + rol (solo company entra)
        const { data: { user }, error: uerr } = await supabase.auth.getUser();
        if (uerr) throw uerr;
        if (!user) {
          setErr("No hay sesión.");
          setLoading(false);
          return;
        }
        if (ignore) return;
        setUser(user);

        // (opcional) Validar rol
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = profile?.role ?? "student";
        if (role !== "company") {
          // Si no es empresa, a su home
          router.replace(role === "professor" ? "/profesores" : "/alumno/buscar");
          return;
        }

        // 1) Obtener la empresa por owner_id
        const { data: company, error } = await supabase
          .from("companies")
          .select("id, name, logo_url, industry, status, owner_id")
          .eq("owner_id", user.id)
          .single();

        if (ignore) return;

        if (error || !company) {
          // No hay empresa para este user → invítalo a crearla
          setErr("No se encontró empresa para este usuario. Crea tu ficha de empresa.");
          setLoading(false);
          // opcional: mándalo directo al signup
          // router.replace("/empresa/signup");
          return;
        }

        setCompany(company);

        // 2) Vacantes de esa empresa
        const { data: vacs, error: verr } = await supabase
          .from("vacancies")
          .select("id, title, status, created_at, spots_total, spots_taken, spots_left, modality, location_text")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false });

        if (verr) throw verr;

        setVacancies(vacs || []);
        setSelectedVac(vacs?.[0] || null);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setErr(e.message || "Error cargando panel de empresa.");
        setLoading(false);
      }
    };

    boot();
    return () => { ignore = true; };
  }, [router]);

  // Cargar postulaciones de la vacante seleccionada
  useEffect(() => {
    let ignore = false;
    const fetchApps = async () => {
      if (!selectedVac) { setApps([]); return; }
      setAppsLoading(true);
      const myId = ++reqSeq.current;

      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, status, offer_expires_at, decision, decision_at, auto_declined, created_at,
          student:profiles!inner (
            id, full_name, avatar_url, cv_url, program_id
          )
        `)
        .eq("vacancy_id", selectedVac.id)
        .in("status", ["postulada","oferta","rechazada","aceptada","retirada"])
        .order("created_at", { ascending: false });

      if (ignore || myId !== reqSeq.current) return;

      if (error) {
        setErr(error.message);
        setApps([]);
      } else {
        setErr("");
        setApps(data || []);
      }
      setAppsLoading(false);
    };
    fetchApps();
    return () => { ignore = true; };
  }, [selectedVac]);

  // Acciones empresa
  const setOffer = async (appId, days = 5) => {
    try {
      const { error } = await supabase.rpc("company_set_application_status", {
        p_app_id: appId,
        p_status: "oferta",
        p_offer_days: days
      });
      if (error) throw error;
      setApps(prev =>
        prev.map(a =>
          a.id === appId
            ? { ...a, status: "oferta", offer_expires_at: new Date(Date.now() + days * 86400000).toISOString() }
            : a
        )
      );
    } catch (e) {
      alert(e.message || "No se pudo marcar como oferta.");
    }
  };

  const setReject = async (appId) => {
    try {
      const { error } = await supabase.rpc("company_set_application_status", {
        p_app_id: appId,
        p_status: "rechazada",
        p_offer_days: 0
      });
      if (error) throw error;
      setApps(prev => prev.map(a => (a.id === appId ? { ...a, status: "rechazada" } : a)));
    } catch (e) {
      alert(e.message || "No se pudo rechazar.");
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="jobs-wrap"><div className="jobs-skeleton">Cargando…</div></main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="jobs-wrap">
        {err && (
          <div className="jobs-error" role="alert">
            {err}{" "}
            {(!company) && (
              <a href="/empresa/signup" style={{ color: "#2563eb", textDecoration: "underline", marginLeft: 8 }}>
                Crear empresa
              </a>
            )}
          </div>
        )}

        <header className="jobs-company-head">
          <div className="jobs-company-id">
            <LogoSquare src={company?.logo_url} />
            <div>
              <h2 className="jobs-title">{company?.name || "Mi empresa"}</h2>
              <div className="jobs-muted">{company?.industry}</div>
            </div>
          </div>
        </header>

        <section className="jobs-grid">
          {/* Lista de vacantes de la empresa */}
          <aside className="jobs-listing">
            <h3 className="jobs-subtitle">Mis vacantes</h3>
            {vacancies.map(v => (
              <button
                key={v.id}
                className={`jobs-card ${selectedVac?.id === v.id ? "is-active" : ""}`}
                onClick={() => setSelectedVac(v)}
              >
                <div className="jobs-card-body">
                  <div className="jobs-card-top" style={{ justifyContent:"space-between" }}>
                    <div>
                      <h4 className="jobs-card-title">{v.title}</h4>
                      <div className="jobs-meta">
                        <span>{v.modality}</span>
                        <span>{v.location_text || "Ubicación N/A"}</span>
                        <span>Estado: {v.status}</span>
                      </div>
                    </div>
                    <div className="jobs-card-right">
                      <div className="jobs-chip">Cupo: {v.spots_taken}/{v.spots_total}</div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {!vacancies.length && <div className="jobs-empty small">Aún no tienes vacantes.</div>}
          </aside>

          {/* Postulaciones de la vacante seleccionada */}
          <article className="jobs-detail">
            {!selectedVac && <div className="jobs-empty">Selecciona una vacante</div>}

            {selectedVac && (
              <div className="jobs-detail-inner">
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h3 className="jobs-title">{selectedVac.title}</h3>
                    <div className="jobs-muted">{selectedVac.location_text || "Ubicación N/A"}</div>
                  </div>
                </header>

                {appsLoading && <div className="jobs-skeleton">Cargando postulaciones…</div>}

                {!appsLoading && (
                  <section className="apps-list">
                    {apps.map(app => (
                      <div key={app.id} className="apps-card">
                        <div className="apps-left">
                          <AvatarSquare src={app.student?.avatar_url} />
                          <div>
                            <div className="apps-name">{app.student?.full_name || "Alumno"}</div>
                            <div className="apps-meta">
                              <span>Estado: {app.status}</span>
                              {app.offer_expires_at && <span>Expira: {new Date(app.offer_expires_at).toLocaleString()}</span>}
                            </div>
                            {app.student?.cv_url && (
                              <div className="apps-actions">
                                <a className="apps-link" href={app.student.cv_url} target="_blank" rel="noreferrer">Ver CV</a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="apps-right">
                          {app.status === "postulada" && (
                            <div className="apps-buttons">
                              <button className="btn btn-primary" onClick={() => setOffer(app.id, 5)}>Preseleccionar</button>
                              <button className="btn btn-ghost" onClick={() => setReject(app.id)}>Rechazar</button>
                            </div>
                          )}

                          {app.status === "oferta" && (
                            <div className="apps-badge">Oferta enviada</div>
                          )}

                          {app.status === "aceptada" && <div className="apps-badge success">Aceptada ✅</div>}
                          {app.status === "rechazada" && <div className="apps-badge muted">Rechazada</div>}
                          {app.status === "retirada" && <div className="apps-badge muted">Retirada por alumno</div>}
                        </div>
                      </div>
                    ))}
                    {!apps.length && <div className="jobs-empty small">Aún no hay postulaciones.</div>}
                  </section>
                )}
              </div>
            )}
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}

/* Mini componentes */
function LogoSquare({ src }) {
  if (!src) return <div className="jobs-logo-fallback" aria-hidden />;
  return (
    <div className="jobs-logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}
function AvatarSquare({ src }) {
  if (!src) return <div className="apps-avatar-fallback" aria-hidden />;
  return (
    <div className="apps-avatar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}
