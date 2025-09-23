// pages/empresa/vacantes/nueva.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Navbar from "../../../components/navbar";
import Footer from "../../../components/footer";
import { supabase } from "../../../lib/supabaseClient";

export default function NuevaVacantePage() {
  const router = useRouter();
  const [company, setCompany] = useState(null);
  const [programs, setPrograms] = useState([]);        // catálogo
  const [programIds, setProgramIds] = useState([]);    // selección
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title:"", modality:"presencial", compensation:"Apoyo económico", language:"ES",
    location_text:"", requirements:"", activities:"", status:"activa", spots_total:1
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const [{ data: comp }, { data: progList }] = await Promise.all([
        supabase.from("companies").select("id,name").eq("owner_id", user.id).single(),
        supabase.from("programs").select("id,key,name").order("name", { ascending: true })
      ]);

      if (!comp) { setErr("Crea tu ficha de empresa primero."); return; }
      setCompany(comp);
      setPrograms(progList || []);
    })();
  }, [router]);

  const save = async () => {
    try {
      if (!company) return;
      if (!form.title.trim()) { alert("Escribe un título."); return; }

      setSaving(true);
      const payload = {
        company_id: company.id,
        title: form.title,
        modality: form.modality,
        compensation: form.compensation,
        language: form.language,
        location_text: form.location_text,
        requirements: form.requirements,
        activities: form.activities,
        spots_total: Number(form.spots_total || 1),
        status: form.status || "activa",
      };

      const { data, error } = await supabase
        .from("vacancies")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // sincroniza programas
      if (programIds.length) {
        const rows = programIds.map(pid => ({ vacancy_id: data.id, program_id: pid }));
        const { error: insErr } = await supabase.from("vacancy_programs").insert(rows);
        if (insErr) throw insErr;
      }

      setSaving(false);
      router.replace(`/empresa/vacante/${data.id}`);
    } catch (e) {
      setSaving(false);
      alert(e.message || "No se pudo crear la vacante.");
    }
  };

  // UI helpers (estilos locales)
  const Field = ({ label, children }) => (
    <div style={{ display:"grid", gap:6 }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#1f2937" }}>{label}</div>
      {children}
    </div>
  );
  const taStyle = { width:"100%", background:"#fff", border:"1px solid #e6eaf1", borderRadius:10, padding:"10px 12px", outline:"none", fontFamily:"inherit", fontSize:14 };
  const cardBox = { background:"#fff", border:"1px solid #e6eaf1", borderRadius:12, padding:"12px", marginTop:10 };
  const cardTitle = { margin:"0 0 8px", fontSize:14, color:"#1f2937" };
  const grid2 = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 };

  return (
    <>
      <Navbar />
      <main className="jobs-wrap">
        <div className="jobs-grid" style={{ gridTemplateColumns:"1fr" }}>
          <article className="jobs-detail" style={{ display:"block" }}>
            <button className="jobs-apply" onClick={()=>router.back()} style={{ marginBottom:10, background:"#111827" }}>
              ← Volver
            </button>
            {err && <div className="jobs-error">{err}</div>}

            <header className="jobs-detail-head">
              <div className="jobs-detail-titles">
                <h3 className="jobs-title">Nueva vacante</h3>
                <div className="jobs-muted">Completa la información para publicar.</div>
              </div>
            </header>

            <div style={cardBox}>
              <h4 style={cardTitle}>Información general</h4>
              <div style={grid2}>
                <Field label="Título del puesto"><input className="login-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></Field>
                <Field label="Ubicación (texto)"><input className="login-input" value={form.location_text} onChange={e=>setForm(f=>({...f,location_text:e.target.value}))}/></Field>
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
              <textarea rows={4} value={form.activities} onChange={e=>setForm(f=>({...f,activities:e.target.value}))} style={taStyle}/>
            </div>
            <div style={cardBox}>
              <h4 style={cardTitle}>Requisitos obligatorios</h4>
              <textarea rows={4} value={form.requirements} onChange={e=>setForm(f=>({...f,requirements:e.target.value}))} style={taStyle}/>
            </div>

            <div className="jobs-cta" style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button className="jobs-more" onClick={()=>router.push("/empresa/vacantes")}>Descartar</button>
              <button className="jobs-apply" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
