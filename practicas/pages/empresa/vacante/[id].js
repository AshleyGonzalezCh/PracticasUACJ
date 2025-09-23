// pages/empresa/vacante/[id].js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "../../../components/navbar";
import Footer from "../../../components/footer";
import { supabase } from "../../../lib/supabaseClient";

export default function EmpresaVacanteDetalle() {
  const router = useRouter();
  const { id } = router.query;

  const [vac, setVac] = useState(null);
  const [programs, setPrograms] = useState([]);        // catálogo [{id,key,name}]
  const [programIds, setProgramIds] = useState([]);    // selección actual (uuid[])
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);
  const [mode, setMode] = useState("view"); // view | edit | apps
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [form, setForm] = useState({
    id: null, title:"", modality:"presencial", compensation:"Apoyo económico",
    language:"ES", location_text:"", requirements:"", activities:"",
    status:"activa", spots_total:1
  });

  // helpers
  const isInactive = (v) => String(v?.status || "").toLowerCase().includes("inactiv");
  const spotsLeft = (v) => Number(v?.spots_left ?? Math.max((v?.spots_total ?? 0) - (v?.spots_taken ?? 0), 0));
  const isFull = (v) => spotsLeft(v) <= 0;

  // cerrar kebab
  useEffect(() => {
    const onClick = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // carga inicial: vacante + programas + program_ids
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);

      // catálogo de programas
      const { data: progList, error: perr } = await supabase
        .from("programs")
        .select("id, key, name")
        .order("name", { ascending: true });
      if (!perr) setPrograms(progList || []);

      // vacante
      const { data, error } = await supabase
        .from("vacancies")
        .select("*")
        .eq("id", id)
        .single();
      if (error) { alert(error.message); setVac(null); setLoading(false); return; }
      setVac(data);

      // program_ids
      const { data: vps } = await supabase
        .from("vacancy_programs")
        .select("program_id")
        .eq("vacancy_id", id);
      const pids = (vps || []).map(r => r.program_id);
      setProgramIds(pids);

      setLoading(false);
    })();
  }, [id]);

  const loadApps = async () => {
    if (!id) return;
    setAppsLoading(true);
    const { data, error } = await supabase
      .from("applications")
      .select(`id, status, offer_expires_at, decision, decision_at, auto_declined, applied_at, created_at,
               student:profiles!inner(id, full_name, avatar_url, cv_url)`)
      .eq("vacancy_id", id)
      .in("status", ["postulada","oferta","rechazada","aceptada","retirada"])
      .order("created_at", { ascending:false });
    if (error) { alert(error.message); setApps([]); }
    else setApps(data || []);
    setAppsLoading(false);
  };

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/empresa/vacantes");
  };

  const beginEdit = () => {
    if (!vac) return;
    setForm({
      id: vac.id, title: vac.title || "", modality: vac.modality || "presencial",
      compensation: vac.compensation || "Apoyo económico", language: vac.language || "ES",
      location_text: vac.location_text || "", requirements: vac.requirements || "",
      activities: vac.activities || "", status: vac.status || "activa",
      spots_total: Number(vac.spots_total ?? 1)
    });
    setMode("edit");
    setMenuOpen(false);
  };

  const syncVacancyPrograms = async (vacancyId, pids = []) => {
    await supabase.from("vacancy_programs").delete().eq("vacancy_id", vacancyId);
    if (pids.length) {
      const rows = pids.map(pid => ({ vacancy_id: vacancyId, program_id: pid }));
      const { error: insErr } = await supabase.from("vacancy_programs").insert(rows);
      if (insErr) throw insErr;
    }
  };

  const saveVacancy = async () => {
    try {
      const payload = { ...form };
      delete payload.id;
      const { error } = await supabase
        .from("vacancies")
        .update({
          ...payload,
          spots_total: Number(form.spots_total || 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", form.id);
      if (error) throw error;

      await syncVacancyPrograms(form.id, programIds);

      setVac(v => ({ ...v, ...payload }));
      setMode("view");
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    }
  };

  const toggleActive = async () => {
    if (!vac) return;
    const inactive = isInactive(vac);
    const ok = confirm(`¿Seguro que deseas ${inactive ? "activar" : "desactivar"} esta vacante?`);
    if (!ok) return;
    try {
      const newStatus = inactive ? "activa" : "inactiva";
      const { error } = await supabase.from("vacancies")
        .update({ status: newStatus }).eq("id", vac.id);
      if (error) throw error;
      setVac(v => ({ ...v, status: newStatus }));
      setMenuOpen(false);
    } catch (e) {
      alert(e.message || "No se pudo actualizar el estado.");
    }
  };

  const sendOffer = async (appId, days=5) => {
    if (isInactive(vac) || isFull(vac)) return alert("Vacante inactiva o sin cupo.");
    const { error } = await supabase.rpc("company_set_application_status", {
      p_app_id: appId, p_status:"oferta", p_offer_days: days
    });
    if (error) {
      const exp = new Date(Date.now() + days*86400000).toISOString();
      const { error: uerr } = await supabase.from("applications").update({
        status:"oferta", offer_expires_at: exp
      }).eq("id", appId);
      if (uerr) return alert(uerr.message);
    }
    setApps(prev => prev.map(a => a.id===appId ? { ...a, status:"oferta", offer_expires_at:new Date(Date.now()+days*86400000).toISOString() } : a));
  };

  const rejectApp = async (appId) => {
    const { error } = await supabase.rpc("company_set_application_status", {
      p_app_id: appId, p_status:"rechazada", p_offer_days: 0
    });
    if (error) {
      const { error: uerr } = await supabase.from("applications").update({ status:"rechazada" }).eq("id", appId);
      if (uerr) return alert(uerr.message);
    }
    setApps(prev => prev.map(a => a.id===appId ? { ...a, status:"rechazada" } : a));
  };

  // UI helpers (estilos locales)
  const taStyle = { width:"100%", background:"#fff", border:"1px solid #e6eaf1", borderRadius:10, padding:"10px 12px", outline:"none", fontFamily:"inherit", fontSize:14 };
  const cardBox = { background:"#fff", border:"1px solid #e6eaf1", borderRadius:12, padding:"12px", marginTop:10 };
  const cardTitle = { margin:"0 0 8px", fontSize:14, color:"#1f2937" };
  const grid2 = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 };

  const Field = ({ label, children }) => (
    <div style={{ display:"grid", gap:6 }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#1f2937" }}>{label}</div>
      {children}
    </div>
  );

  return (
    <>
      <Navbar />
      <main className="jobs-wrap">
        <div className="jobs-grid" style={{ gridTemplateColumns:"1fr" }}>
          <article className="jobs-detail" style={{ display:"block" }}>
            <button className="jobs-apply" onClick={goBack} style={{ marginBottom:10, background:"#111827" }}>
              ← Volver
            </button>

            {loading && <div className="jobs-skeleton">Cargando…</div>}
            {!loading && !vac && <div className="jobs-empty">Vacante no encontrada</div>}

            {!loading && vac && mode === "view" && (
              <>
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h2 className="jobs-title">{vac.title}</h2>
                    <div className="jobs-chips">
                      <span className="jobs-chip">{vac.modality}</span>
                      <span className="jobs-chip">{vac.compensation}</span>
                      <span className="jobs-chip">Idioma {vac.language || "ES"}</span>
                      {programIds.map(pid => {
                        const p = programs.find(x => x.id === pid);
                        return <span key={pid} className="jobs-chip">Programa {p?.key || "?"}</span>;
                      })}
                    </div>
                    <p className="jobs-location">
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                        <path fill="currentColor" d="M12 2A7 7 0 0 0 5 9c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
                      </svg>
                      {vac.location_text || "Ubicación no especificada"}
                    </p>
                  </div>

                  <div ref={menuRef} data-kebab style={{ position:"relative" }}>
                    <button className="iconbtn" aria-label="Más acciones" onClick={()=>setMenuOpen(s=>!s)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                        <path fill="currentColor" d="M12 7a2 2 0 110-4 2 2 0 010 4m0 7a2 2 0 110-4 2 2 0 010 4m0 7a2 2 0 110-4 2 2 0 010 4"/>
                      </svg>
                    </button>
                    {menuOpen && (
                      <div role="menu" style={{
                        position:"absolute", right:0, top:28, background:"#fff", border:"1px solid #e6eaf1",
                        borderRadius:8, boxShadow:"0 8px 20px rgba(0,0,0,.08)", minWidth:200, zIndex:20, padding:6
                      }}>
                        <button className="jobs-more" onClick={beginEdit} style={{ width:"100%", textAlign:"left" }}>Editar vacante</button>
                        <button className="jobs-more" onClick={toggleActive} style={{ width:"100%", textAlign:"left" }}>
                          {isInactive(vac) ? "Activar" : "Desactivar"}
                        </button>
                        <button className="jobs-more" onClick={() => { setMode("apps"); loadApps(); }} style={{ width:"100%", textAlign:"left" }}>
                          Ver postulaciones
                        </button>
                      </div>
                    )}
                  </div>
                </header>

                {/* Cupo aquí */}
                <div style={{ display:"flex", gap:8, margin:"4px 0 10px" }}>
                  <div className={`jobs-chip ${isFull(vac) ? "danger" : ""}`}>
                    Cupo: {vac.spots_taken ?? 0}/{vac.spots_total ?? 1}
                  </div>
                </div>

                {vac.activities && (
                  <section className="jobs-section">
                    <h3>Actividades</h3>
                    <ul className="jobs-list">{splitLines(vac.activities).map((t,i)=><li key={i}>{t}</li>)}</ul>
                  </section>
                )}
                {vac.requirements && (
                  <section className="jobs-section">
                    <h3>Requisitos</h3>
                    <ul className="jobs-list">{splitLines(vac.requirements).map((t,i)=><li key={i}>{t}</li>)}</ul>
                  </section>
                )}
              </>
            )}

            {!loading && vac && mode === "apps" && (
              <>
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles"><h3 className="jobs-title">Postulaciones: {vac.title}</h3></div>
                </header>
                {appsLoading && <div className="jobs-skeleton">Cargando postulaciones…</div>}
                {!appsLoading && (
                  <section className="apps-list">
                    {apps.map(app => {
                      const canOffer = app.status === "postulada" && !isInactive(vac) && !isFull(vac);
                      return (
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
                                <button className="btn btn-primary" onClick={()=>sendOffer(app.id,5)} disabled={!canOffer}>Enviar oferta</button>
                                <button className="btn btn-ghost" onClick={()=>rejectApp(app.id)}>Rechazar</button>
                              </div>
                            )}
                            {app.status === "oferta" && <div className="apps-badge">Oferta enviada</div>}
                            {app.status === "aceptada" && <div className="apps-badge success">Aceptada ✅</div>}
                            {app.status === "rechazada" && <div className="apps-badge muted">Rechazada</div>}
                            {app.status === "retirada" && <div className="apps-badge muted">Retirada</div>}
                          </div>
                        </div>
                      );
                    })}
                    {!apps.length && <div className="jobs-empty small">Aún no hay postulaciones.</div>}
                  </section>
                )}
                <div className="jobs-cta" style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button className="jobs-more" onClick={()=>setMode("view")}>Volver</button>
                </div>
              </>
            )}

            {!loading && vac && mode === "edit" && (
              <>
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h3 className="jobs-title">Editar vacante</h3>
                    <div className="jobs-muted">Actualiza la información de la vacante.</div>
                  </div>
                </header>

                {/* Form idéntico a desktop, con Programas */}
                <div style={cardBox}>
                  <h4 style={cardTitle}>Información general</h4>
                  <div style={grid2}>
                    <Field label="Título del puesto"><input className="login-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></Field>
                    <Field label="Ubicación (texto)"><input className="login-input" value={form.location_text} onChange={e=>setForm(f=>({...f,location_text:e.target.value}))} /></Field>
                    <Field label="Compensación">
                      <select className="login-input" value={form.compensation} onChange={e=>setForm(f=>({...f,compensation:e.target.value}))}>
                        <option>Apoyo económico</option><option>Sin apoyo</option>
                      </select>
                    </Field>
                    <Field label="Modalidad">
                      <select className="login-input" value={form.modality} onChange={e=>setForm(f=>({...f,modality:e.target.value}))}>
                        <option value="presencial">presencial</option>
                        <option value="híbrido">híbrido</option>
                        <option value="remoto">remoto</option>
                      </select>
                    </Field>
                    <Field label="Idioma">
                      <select className="login-input" value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value}))}>
                        <option>ES</option><option>EN</option>
                      </select>
                    </Field>
                    <Field label="Cupo total">
                      <input className="login-input" type="number" min={1} value={form.spots_total} onChange={e=>setForm(f=>({...f,spots_total:Number(e.target.value || 1)}))}/>
                    </Field>
                    <Field label="Estado">
                      <select className="login-input" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                        <option value="activa">activa</option>
                        <option value="inactiva">inactiva</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <div style={cardBox}>
                  <h4 style={cardTitle}>Programas</h4>
                  <div style={{ display:"grid", gap:8 }}>
                    {programs.map(p => {
                      const checked = programIds.includes(p.id);
                      return (
                        <label key={p.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setProgramIds(prev => {
                                const set = new Set(prev);
                                if (on) set.add(p.id); else set.delete(p.id);
                                return Array.from(set);
                              });
                            }}
                          />
                          <span>{p.key} — {p.name}</span>
                        </label>
                      );
                    })}
                    {!programs.length && <div className="jobs-muted small">No hay programas dados de alta.</div>}
                  </div>
                </div>

                <div style={cardBox}>
                  <h4 style={cardTitle}>Actividades</h4>
                  <textarea rows={4} value={form.activities} onChange={e=>setForm(f=>({...f,activities:e.target.value}))} style={taStyle} />
                </div>
                <div style={cardBox}>
                  <h4 style={cardTitle}>Requisitos obligatorios</h4>
                  <textarea rows={4} value={form.requirements} onChange={e=>setForm(f=>({...f,requirements:e.target.value}))} style={taStyle} />
                </div>

                <div className="jobs-cta" style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                  <button className="jobs-more" onClick={()=>setMode("view")}>Descartar</button>
                  <button className="jobs-apply" onClick={saveVacancy}>Guardar</button>
                </div>
              </>
            )}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}

function splitLines(text) {
  const arr = String(text || "").split(/\r?\n|•|- /).map(s=>s.trim()).filter(Boolean);
  return arr.length ? arr : ["No disponible"];
}
function AvatarSquare({ src }) {
  if (!src) return <div className="apps-avatar-fallback" aria-hidden />;
  return <div className="apps-avatar"><img src={src} alt="" /></div>;
}
