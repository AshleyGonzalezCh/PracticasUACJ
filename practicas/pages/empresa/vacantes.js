// pages/empresa/vacantes.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/navbar";
import Footer from "../../components/footer";

export default function EmpresaVacantesPage() {
  const router = useRouter();

  // ------- loading / errores -------
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ------- catálogos -------
  const [programs, setPrograms] = useState([]); // [{id,key,name}]

  // ------- empresa y data -------
  const [company, setCompany] = useState(null);
  const [vacancies, setVacancies] = useState([]); // cada vacante con .program_ids: uuid[]
  const [selected, setSelected] = useState(null);

  // ------- modos del panel derecho (desktop) -------
  const [mode, setMode] = useState("view"); // 'view' | 'edit' | 'apps'
  const [editForm, setEditForm] = useState(null);

  // ------- postulaciones -------
  const [apps, setApps] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [openAppId, setOpenAppId] = useState(null);
  const reqSeq = useRef(0);

  // ------- búsqueda / filtros -------
  const [q, setQ] = useState("");
  const [fltEstado, setFltEstado] = useState(""); // "", "activa", "inactiva"
  const [fltCupo, setFltCupo] = useState("");     // "", "con_cupo", "llenas"

  // ------- kebab (sólo panel derecho) -------
  const [openMenuDetail, setOpenMenuDetail] = useState(false);
  const pageRef = useRef(null);

  // ================= Helpers generales =================
  const isInactive = (v) => String(v?.status || "").toLowerCase().includes("inactiv");
  const spotsLeft = (v) => Number(v?.spots_left ?? Math.max((v?.spots_total ?? 0) - (v?.spots_taken ?? 0), 0));
  const isFull = (v) => spotsLeft(v) <= 0;
  const isMobile = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;

  const filtered = useMemo(() => {
    let arr = vacancies;
    const qq = (q || "").trim().toLowerCase();
    if (qq) arr = arr.filter(v => v.title?.toLowerCase().includes(qq));
    if (fltEstado === "activa") arr = arr.filter(v => !isInactive(v));
    if (fltEstado === "inactiva") arr = arr.filter(v => isInactive(v));
    if (fltCupo === "con_cupo") arr = arr.filter(v => spotsLeft(v) > 0 && !isInactive(v));
    if (fltCupo === "llenas") arr = arr.filter(v => (isFull(v) && !isInactive(v)) || isInactive(v));
    return arr;
  }, [vacancies, q, fltEstado, fltCupo]);

  // ================= Boot: user -> company -> programs -> vacancies (+program_ids) =================
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // 0) Usuario y rol
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setErr("No hay sesión."); setLoading(false); return; }

        const { data: profile } = await supabase
          .from("profiles").select("role").eq("id", user.id).single();
        const role = profile?.role ?? "student";
        if (role !== "company") {
          router.replace(role === "professor" ? "/profesores" : "/alumno/buscar");
          return;
        }

        // 1) Empresa del owner
        const { data: comp, error: cerr } = await supabase
          .from("companies")
          .select("id, name, logo_url, industry, owner_id, status")
          .eq("owner_id", user.id)
          .single();
        if (!comp || cerr) {
          setErr("No se encontró empresa para este usuario. Crea tu ficha de empresa.");
          setLoading(false);
          return;
        }
        if (ignore) return;
        setCompany(comp);

        // 2) Catálogo de programas
        const { data: progList, error: perr } = await supabase
          .from("programs")
          .select("id, key, name")
          .order("name", { ascending: true });
        if (perr) throw perr;
        if (!ignore) setPrograms(progList || []);

        // 3) Vacantes de la empresa
        const { data: vacs, error: verr } = await supabase
          .from("vacancies")
          .select(`
            id, title, status, created_at, spots_total, spots_taken, spots_left,
            modality, location_text, compensation, language, requirements, activities
          `)
          .eq("company_id", comp.id)
          .order("created_at", { ascending: false });
        if (verr) throw verr;

        let list = vacs || [];

        // 4) Cargar program_ids para todas las vacantes en una sola consulta
        if (list.length) {
          const idsCSV = `(${list.map(v => `"${v.id}"`).join(",")})`;
          const { data: vps } = await supabase
            .from("vacancy_programs")
            .select("vacancy_id, program_id")
            .filter("vacancy_id", "in", idsCSV);

          const map = new Map(); // vacancy_id -> program_ids[]
          (vps || []).forEach(row => {
            const arr = map.get(row.vacancy_id) || [];
            arr.push(row.program_id);
            map.set(row.vacancy_id, arr);
          });

          list = list.map(v => ({ ...v, program_ids: map.get(v.id) || [] }));
        }

        if (ignore) return;
        setVacancies(list);
        setSelected(list?.[0] || null);
        setMode("view");
        setLoading(false);
      } catch (e) {
        console.error(e);
        if (!ignore) {
          setErr(e.message || "Error cargando panel.");
          setLoading(false);
        }
      }
    })();
    return () => { ignore = true; };
  }, [router]);

  // ================= Click fuera para cerrar kebab =================
  useEffect(() => {
    const onClick = (e) => {
      if (!pageRef.current) return;
      if (!pageRef.current.contains(e.target)) return;
      const inKebab = e.target.closest?.("[data-kebab]");
      if (!inKebab) setOpenMenuDetail(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ================= Navegación selección =================
  const selectDesktop = (v) => {
    setSelected(v);
    setMode("view");
    setEditForm(null);
    setOpenAppId(null);
    setOpenMenuDetail(false);
  };

  const onSelect = (v) => {
    if (isMobile()) {
      router.push(`/empresa/vacante/${v.id}`);
      return;
    }
    selectDesktop(v);
  };

  // ================= Acciones (nueva/editar/apps/estado) =================
  const openNew = () => {
    if (isMobile()) {
      router.push("/empresa/vacante/nueva");
      return;
    }
    const blank = {
      id: null,
      title: "",
      modality: "presencial",
      compensation: "Apoyo económico",
      language: "ES",
      location_text: "",
      requirements: "",
      activities: "",
      status: "activa",
      spots_total: 1,
      program_ids: [], // << programas seleccionados
    };
    setSelected(null);
    setEditForm(blank);
    setMode("edit");
    setOpenMenuDetail(false);
  };

  const beginEditSelected = () => {
    if (!selected) return;
    if (isMobile()) {
      router.push(`/empresa/vacante/${selected.id}?edit=1`);
      return;
    }
    setEditForm({
      id: selected.id,
      title: selected.title || "",
      modality: selected.modality || "presencial",
      compensation: selected.compensation || "Apoyo económico",
      language: selected.language || "ES",
      location_text: selected.location_text || "",
      requirements: selected.requirements || "",
      activities: selected.activities || "",
      status: selected.status || "activa",
      spots_total: Number(selected.spots_total ?? 1),
      program_ids: Array.isArray(selected.program_ids) ? [...selected.program_ids] : [], // << cargar actuales
    });
    setMode("edit");
    setOpenMenuDetail(false);
  };

  const goApps = () => {
    if (!selected) return;
    if (isMobile()) {
      router.push(`/empresa/vacante/${selected.id}#postulaciones`);
      return;
    }
    setMode("apps");
    setOpenAppId(null);
    setOpenMenuDetail(false);
  };

  const toggleActive = async (vac) => {
    const inactive = isInactive(vac);
    const ok = confirm(`¿Seguro que deseas ${inactive ? "activar" : "desactivar"} esta vacante?`);
    if (!ok) return;
    try {
      const newStatus = inactive ? "activa" : "inactiva";
      const { error } = await supabase.from("vacancies")
        .update({ status: newStatus })
        .eq("id", vac.id);
      if (error) throw error;
      setVacancies(prev => prev.map(v => v.id === vac.id ? { ...v, status: newStatus } : v));
      if (selected?.id === vac.id) setSelected(s => ({ ...s, status: newStatus }));
      setOpenMenuDetail(false);
    } catch (e) {
      alert(e.message || "No se pudo actualizar el estado.");
    }
  };

  // ================= Guardar/descartar (form) =================
  const onDiscard = () => {
    if (editForm?.id) {
      const v = vacancies.find(x => x.id === editForm.id);
      if (v) selectDesktop(v);
      else { setMode("view"); setEditForm(null); }
    } else {
      if (selected) setMode("view");
      else { setMode("view"); setEditForm(null); }
    }
  };

  // sincroniza vacancy_programs: borra e inserta
  const syncVacancyPrograms = async (vacancyId, programIds = []) => {
    await supabase.from("vacancy_programs").delete().eq("vacancy_id", vacancyId);
    if (programIds.length) {
      const rows = programIds.map(pid => ({ vacancy_id: vacancyId, program_id: pid }));
      const { error: insErr } = await supabase.from("vacancy_programs").insert(rows);
      if (insErr) throw insErr;
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const f = editForm;
      if (!f.title?.trim()) { alert("Escribe un título."); return; }

      if (f.id) {
        // update
        const { data, error } = await supabase
          .from("vacancies")
          .update({
            title: f.title,
            modality: f.modality,
            compensation: f.compensation,
            language: f.language,
            location_text: f.location_text,
            requirements: f.requirements,
            activities: f.activities,
            spots_total: Number(f.spots_total || 1),
            status: f.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", f.id)
          .select()
          .single();
        if (error) throw error;

        // sync programas
        await syncVacancyPrograms(f.id, f.program_ids || []);

        // refresca UI
        const updated = { ...data, program_ids: [...(f.program_ids || [])] };
        setVacancies(prev => prev.map(v => v.id === f.id ? updated : v));
        setSelected(updated);
        setMode("view");
        setEditForm(null);
      } else {
        // insert
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user || !company) throw new Error("Falta usuario o empresa.");

        const { data, error } = await supabase
          .from("vacancies")
          .insert({
            company_id: company.id,
            title: f.title,
            modality: f.modality,
            compensation: f.compensation,
            language: f.language,
            location_text: f.location_text,
            requirements: f.requirements,
            activities: f.activities,
            spots_total: Number(f.spots_total || 1),
            status: f.status || "activa",
          })
          .select()
          .single();
        if (error) throw error;

        // sync programas
        await syncVacancyPrograms(data.id, f.program_ids || []);

        const newVac = { ...data, program_ids: [...(f.program_ids || [])] };
        setVacancies(prev => [newVac, ...prev]);
        selectDesktop(newVac);
      }
    } catch (e2) {
      console.error(e2);
      alert(e2.message || "No se pudo guardar la vacante.");
    }
  };

  // ================= Postulaciones (apps) =================
  useEffect(() => {
    let ignore = false;
    const fetchApps = async () => {
      if (!selected || mode !== "apps") { setApps([]); return; }
      setAppsLoading(true);
      const myId = ++reqSeq.current;

      const { data, error } = await supabase
        .from("applications")
        .select(`
          id, status, offer_expires_at, decision, decision_at, auto_declined, applied_at, created_at,
          student:profiles!inner ( id, full_name, avatar_url, cv_url, program_id )
        `)
        .eq("vacancy_id", selected.id)
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
  }, [selected, mode]);

  const sendOffer = async (appId, days = 5) => {
    try {
      if (!selected) return;
      if (isInactive(selected) || isFull(selected)) {
        alert("Esta vacante no tiene cupo disponible o está inactiva.");
        return;
      }
      // usa RPC si lo tienes
      const useRPC = true;
      if (useRPC) {
        const { error } = await supabase.rpc("company_set_application_status", {
          p_app_id: appId,
          p_status: "oferta",
          p_offer_days: days,
        });
        if (error) throw error;
      } else {
        const exp = new Date(Date.now() + days * 86400000).toISOString();
        const { error } = await supabase
          .from("applications")
          .update({ status: "oferta", offer_expires_at: exp })
          .eq("id", appId);
        if (error) throw error;
      }
      // optimistic
      setApps(prev => prev.map(a => a.id === appId
        ? { ...a, status: "oferta", offer_expires_at: new Date(Date.now() + days * 86400000).toISOString() }
        : a));
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo marcar como oferta.");
    }
  };

  const rejectApp = async (appId) => {
    try {
      const useRPC = true;
      if (useRPC) {
        const { error } = await supabase.rpc("company_set_application_status", {
          p_app_id: appId,
          p_status: "rechazada",
          p_offer_days: 0,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("applications")
          .update({ status: "rechazada" })
          .eq("id", appId);
        if (error) throw error;
      }
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: "rechazada" } : a));
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo rechazar la postulación.");
    }
  };

  // ================= Render =================
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
      <main className="jobs-wrap" ref={pageRef}>
        {err && (
          <div className="jobs-error" role="alert">
            {err} {!company && <a href="/empresa/signup" style={{ color:"#2563eb", textDecoration:"underline", marginLeft:8 }}>Crear empresa</a>}
          </div>
        )}

        {/* Barra de búsqueda */}
        <div className="jobs-searchbar">
          <div className="jobs-input">
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
            </svg>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por título de la vacante" />
          </div>
          {/* Botón estratégico (acorde a tu estilo) */}
          <button className="jobs-searchbtn" onClick={openNew} aria-label="Crear nueva vacante">
            Nueva vacante
          </button>
        </div>

        {/* Filtros */}
        <div className="jobs-filters">
          <Pill label="Estado" value={fltEstado} onChange={setFltEstado}
            options={["","activa","inactiva"]}
            labels={{"": "Todas", activa:"Activas", inactiva:"Inactivas"}}
          />
          <Pill label="Cupo" value={fltCupo} onChange={setFltCupo}
            options={["","con_cupo","llenas"]}
            labels={{"": "Todas", con_cupo:"Con cupo", llenas:"Llenas"}}
          />
        </div>

        <section className="jobs-grid">
          {/* Lista de vacantes */}
          <aside className="jobs-listing">
            {filtered.map(v => (
              <button key={v.id} className={`jobs-card ${selected?.id === v.id ? "is-active" : ""}`} onClick={()=>onSelect(v)}>
                <div className="jobs-card-body">
                  <div className="jobs-card-top" style={{ justifyContent:"space-between" }}>
                    <div>
                      <h4 className="jobs-card-title" style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <EstadoDot v={v} />
                        {v.title}
                      </h4>
                      <div className="jobs-meta">
                        <span>Compensación {v.compensation || "N/A"}</span>
                        <span>Modalidad {v.modality}</span>
                      </div>
                      <div className="jobs-loc-row">
                        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                          <path fill="currentColor" d="M12 2A7 7 0 0 0 5 9c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
                        </svg>
                        <span className="jobs-muted">{v.location_text || "Ubicación N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {!filtered.length && <div className="jobs-empty small">Sin vacantes con esos filtros.</div>}
          </aside>

          {/* Panel derecho */}
          <article className="jobs-detail">
            {/* VIEW */}
            {mode === "view" && !selected && <div className="jobs-empty">Selecciona una vacante.</div>}

            {mode === "view" && selected && (
              <div className="jobs-detail-inner">
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h2 className="jobs-title" style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <EstadoDot v={selected} /> {selected.title}
                    </h2>
                    <div className="jobs-chips">
                      <span className="jobs-chip">{selected.modality}</span>
                      <span className="jobs-chip">{selected.compensation}</span>
                      <span className="jobs-chip">Idioma {selected.language || "ES"}</span>
                      {/* Chips de programas */}
                      {selected?.program_ids?.length > 0 && selected.program_ids.map(pid => {
                        const p = programs.find(x => x.id === pid);
                        return <span key={pid} className="jobs-chip">Programa {p?.key || "?"}</span>;
                      })}
                    </div>
                    <p className="jobs-location">
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                        <path fill="currentColor" d="M12 2A7 7 0 0 0 5 9c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
                      </svg>
                      {selected.location_text || "Ubicación no especificada"}
                    </p>
                  </div>

                  <div data-kebab style={{ position:"relative" }}>
                    <button className="iconbtn" aria-label="Más acciones" onClick={()=>setOpenMenuDetail(s=>!s)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                        <path fill="currentColor" d="M12 7a2 2 0 110-4 2 2 0 010 4m0 7a2 2 0 110-4 2 2 0 010 4m0 7a2 2 0 110-4 2 2 0 010 4"/>
                      </svg>
                    </button>
                    {openMenuDetail && (
                      <Menu>
                        <MenuItem onClick={beginEditSelected}>Editar</MenuItem>
                        <MenuItem onClick={()=>toggleActive(selected)}>
                          {String(selected.status).toLowerCase().includes("inactiv") ? "Activar vacante" : "Desactivar vacante"}
                        </MenuItem>
                        <MenuItem onClick={goApps}>Ver postulaciones</MenuItem>
                      </Menu>
                    )}
                  </div>
                </header>

                {/* Cupo aquí */}
                <div style={{ display:"flex", gap:8, margin:"4px 0 10px" }}>
                  <div className={`jobs-chip ${isFull(selected) ? "danger" : ""}`}>
                    Cupo: {selected.spots_taken ?? 0}/{selected.spots_total ?? 1}
                  </div>
                </div>

                {selected.activities && (
                  <section className="jobs-section">
                    <h3>Actividades</h3>
                    <ul className="jobs-list">{splitLines(selected.activities).map((t,i)=><li key={i}>{t}</li>)}</ul>
                  </section>
                )}

                {selected.requirements && (
                  <section className="jobs-section">
                    <h3>Requisitos</h3>
                    <ul className="jobs-list">{splitLines(selected.requirements).map((t,i)=><li key={i}>{t}</li>)}</ul>
                  </section>
                )}

                <div className="jobs-cta" style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button className="jobs-searchbtn" onClick={goApps}>
                    Ver postulaciones
                  </button>
                </div>
              </div>
            )}

            {/* EDIT (inline en desktop) */}
            {mode === "edit" && (
              <div className="jobs-detail-inner">
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h3 className="jobs-title">{editForm?.id ? "Editar vacante" : "Nueva vacante"}</h3>
                    <div className="jobs-muted small">Ajusta los campos y guarda los cambios.</div>
                  </div>
                </header>

                <form onSubmit={onSave} className="signup-form" style={{ display:"grid", gap:12 }}>
                  <div className="jobs-chips" style={{ gap:10 }}>
                    <span className="jobs-chip">Estado: {editForm?.status || "activa"}</span>
                    <span className="jobs-chip">Cupo total: {Number(editForm?.spots_total ?? 1)}</span>
                  </div>

                  <input
                    className="login-input"
                    type="text"
                    placeholder="Título de la vacante"
                    value={editForm?.title || ""}
                    onChange={(e)=>setEditForm(f=>({ ...f, title: e.target.value }))}
                    required
                  />

                  <div style={{ display:"grid", gap:10, gridTemplateColumns:"1fr 1fr 1fr" }}>
                    <label className="jobs-pill" style={{ gap:8 }}>
                      <span className="lbl">Modalidad</span>
                      <select
                        value={editForm?.modality || "presencial"}
                        onChange={(e)=>setEditForm(f=>({ ...f, modality: e.target.value }))}
                      >
                        <option value="presencial">Presencial</option>
                        <option value="híbrido">Híbrida</option>
                        <option value="remoto">Remota</option>
                      </select>
                    </label>

                    <label className="jobs-pill" style={{ gap:8 }}>
                      <span className="lbl">Compensación</span>
                      <select
                        value={editForm?.compensation || "Apoyo económico"}
                        onChange={(e)=>setEditForm(f=>({ ...f, compensation: e.target.value }))}
                      >
                        <option value="Apoyo económico">Apoyo económico</option>
                        <option value="Sin apoyo">Sin apoyo</option>
                      </select>
                    </label>

                    <label className="jobs-pill" style={{ gap:8 }}>
                      <span className="lbl">Idioma</span>
                      <select
                        value={editForm?.language || "ES"}
                        onChange={(e)=>setEditForm(f=>({ ...f, language: e.target.value }))}
                      >
                        <option value="ES">ES</option>
                        <option value="EN">EN</option>
                      </select>
                    </label>
                  </div>

                  <input
                    className="login-input"
                    type="text"
                    placeholder="Ubicación (texto)"
                    value={editForm?.location_text || ""}
                    onChange={(e)=>setEditForm(f=>({ ...f, location_text: e.target.value }))}
                  />

                  <div style={{ display:"grid", gap:10, gridTemplateColumns:"1fr 1fr" }}>
                    <label className="jobs-pill" style={{ gap:8 }}>
                      <span className="lbl">Estado</span>
                      <select
                        value={editForm?.status || "activa"}
                        onChange={(e)=>setEditForm(f=>({ ...f, status: e.target.value }))}
                      >
                        <option value="activa">Activa</option>
                        <option value="inactiva">Inactiva</option>
                      </select>
                    </label>

                    <label className="jobs-pill" style={{ gap:8 }}>
                      <span className="lbl">Cupo total</span>
                      <input
                        className="login-input"
                        type="number"
                        min={1}
                        value={editForm?.spots_total ?? 1}
                        onChange={(e)=>setEditForm(f=>({ ...f, spots_total: Number(e.target.value || 1) }))}
                        style={{ width:"120px" }}
                      />
                    </label>
                  </div>

                  {/* ====== Programas (multi-select por checkbox) ====== */}
                  <label className="jobs-pill" style={{ gap:8, alignItems:"flex-start" }}>
                    <span className="lbl" style={{ paddingTop:10 }}>Programas</span>
                    <div style={{ display:"grid", gap:6 }}>
                      {programs.map(p => {
                        const checked = (editForm?.program_ids || []).includes(p.id);
                        return (
                          <label key={p.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setEditForm(f => {
                                  const set = new Set(f.program_ids || []);
                                  if (on) set.add(p.id); else set.delete(p.id);
                                  return { ...f, program_ids: Array.from(set) };
                                });
                              }}
                            />
                            <span>{p.key} — {p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </label>

                  <textarea
                    className="login-input"
                    rows={4}
                    placeholder="Actividades (una por línea)"
                    value={editForm?.activities || ""}
                    onChange={(e)=>setEditForm(f=>({ ...f, activities: e.target.value }))}
                  />
                  <textarea
                    className="login-input"
                    rows={4}
                    placeholder="Requisitos (uno por línea)"
                    value={editForm?.requirements || ""}
                    onChange={(e)=>setEditForm(f=>({ ...f, requirements: e.target.value }))}
                  />

                  <div className="jobs-cta" style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                    <button type="button" className="jobs-apply" onClick={onDiscard} style={{ background:"#ffffffff", color: "#1F3354" }}>
                      Descartar
                    </button>
                    <button className="jobs-apply" type="submit">
                      Guardar cambios
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* APPS (inline en desktop) */}
            {mode === "apps" && selected && (
              <div className="jobs-detail-inner">
                <header className="jobs-detail-head">
                  <div className="jobs-detail-titles">
                    <h3 className="jobs-title">Postulaciones: {selected.title}</h3>
                    <div className="jobs-muted small">
                      Al enviar una oferta se notificará al alumno. La plaza solo se confirma cuando el alumno acepta tu oferta.
                    </div>
                  </div>
                  <button className="jobs-searchbtn" onClick={()=>setMode("view")}>Volver</button>
                </header>

                <div style={{ display:"flex", gap:8, margin:"6px 0 10px" }}>
                  <div className={`jobs-chip ${isFull(selected) ? "danger" : ""}`}>
                    Cupo: {selected.spots_taken ?? 0}/{selected.spots_total ?? 1}
                  </div>
                </div>

                {appsLoading && <div className="jobs-skeleton">Cargando postulaciones…</div>}

                {!appsLoading && (
                  <section className="apps-list">
                    {apps.map((app) => {
                      const canOffer =
                        app.status === "postulada" && !isInactive(selected) && !isFull(selected);
                      const open = openAppId === app.id;

                      return (
                        <div
                          key={app.id}
                          className="apps-card"
                          style={{ cursor: "pointer" }}
                          onClick={() => setOpenAppId(open ? null : app.id)}
                        >
                          <div className="apps-left">
                            <AvatarSquare src={app.student?.avatar_url} />
                            <div>
                              <div className="apps-name">{app.student?.full_name || "Alumno"}</div>
                              <div className="apps-meta">
                                <span>Estado: {app.status}</span>
                                {app.offer_expires_at && (
                                  <span>Expira: {new Date(app.offer_expires_at).toLocaleString()}</span>
                                )}
                              </div>

                              {open && app.student?.cv_url && (
                                <div className="apps-actions">
                                  <a
                                    className="apps-link"
                                    href={app.student.cv_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Ver CV
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="apps-right" onClick={(e) => e.stopPropagation()}>
                            {open && app.status === "postulada" && (
                              <div className="apps-buttons">
                                <button
                                  className="btn btn-primary"
                                  onClick={() => sendOffer(app.id, 5)}
                                  disabled={!canOffer}
                                  title={
                                    canOffer ? "Enviar oferta" :
                                    isFull(selected) ? "Sin cupo disponible" : "Estado no permitido"
                                  }
                                >
                                  Enviar oferta
                                </button>
                                <button className="btn btn-ghost" onClick={() => rejectApp(app.id)}>
                                  Rechazar
                                </button>
                              </div>
                            )}

                            {open && app.status === "oferta" && <div className="apps-badge">Oferta enviada</div>}
                            {open && app.status === "aceptada" && <div className="apps-badge success">Aceptada ✅</div>}
                            {open && app.status === "rechazada" && <div className="apps-badge muted">Rechazada</div>}
                            {open && app.status === "retirada" && <div className="apps-badge muted">Retirada por alumno</div>}
                          </div>
                        </div>
                      );
                    })}
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

/* ---------- Subcomponentes ---------- */
function EstadoDot({ v }) {
  const left = Number(v?.spots_left ?? Math.max((v?.spots_total ?? 0) - (v?.spots_taken ?? 0), 0));
  const inactive = String(v?.status || "").toLowerCase().includes("inactiv");
  const full = left <= 0;
  const info = inactive
    ? { c:"#9ca3af", t:"Vacante inactiva"}
    : (full ? { c:"#2563eb", t:"Cupo lleno"} : { c:"#10b981", t:"Activa (con cupo)" });
  return (
    <span
      title={info.t}
      style={{ display:"inline-block", width:10, height:10, borderRadius:999, background:info.c, boxShadow:"0 0 0 2px #fff" }}
    />
  );
}

function Pill({ label, value, options = [], onChange, labels }) {
  return (
    <label className="jobs-pill">
      <span className="lbl">{label}</span>
      <select value={value} onChange={(e)=>onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o || "all"} value={o}>{(labels && labels[o]) ?? (o || "Todos")}</option>
        ))}
      </select>
    </label>
  );
}

function Menu({ children }) {
  return (
    <div role="menu" style={{
      position:"absolute", right:0, top:28, background:"#fff", border:"1px solid #e6eaf1",
      borderRadius:8, boxShadow:"0 8px 20px rgba(0,0,0,.08)", minWidth:220, zIndex:20, padding:6
    }}>
      {children}
    </div>
  );
}
function MenuItem({ children, onClick }) {
  return (
    <button
      className="jobs-more"
      onClick={onClick}
      style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", border:"none", background:"transparent", cursor:"pointer" }}
    >
      {children}
    </button>
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

function splitLines(text) {
  const arr = String(text || "").split(/\r?\n|•|- /).map(s=>s.trim()).filter(Boolean);
  return arr.length ? arr : ["No disponible"];
}
