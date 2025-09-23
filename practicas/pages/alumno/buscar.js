// pages/alumno/buscar.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/navbar";
import Footer from "../../components/footer";

/* ---------- Catálogos mostrados en UI (bonitos) ---------- */
const MODALIDADES = ["Presencial", "Híbrida", "Remota"];
const COMPENSACIONES = ["Apoyo económico", "Sin apoyo"];
const IDIOMAS = ["ES", "EN"];

/* ---------- Normalizador y Mapas UI <-> BD ---------- */
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const mapUIToDB_mod = (v) => {
  const k = norm(v);
  if (k === "presencial") return "presencial";
  if (k === "hibrida" || k === "hibrido") return "híbrido"; // en BD con tilde
  if (k === "remota" || k === "remoto") return "remoto";
  return null;
};

const COMP_VARIANTS = {
  apoyo: ["apoyo_economico", "apoyo economico", "Apoyo económico", "apoyo económico", "APOYO ECONOMICO"],
  sin: ["sin_apoyo", "sin apoyo", "Sin apoyo", "SIN APOYO"],
};

const MAP_DB_TO_UI = {
  modalidad: { presencial: "Presencial", "híbrido": "Híbrida", remoto: "Remota" },
  comp: {
    apoyo_economico: "Apoyo económico",
    "Apoyo económico": "Apoyo económico",
    sin_apoyo: "Sin apoyo",
    "Sin apoyo": "Sin apoyo",
  },
};
const fmtMod = (dbVal) => MAP_DB_TO_UI.modalidad[dbVal] ?? dbVal ?? "Modalidad N/A";
const fmtComp = (dbVal) => MAP_DB_TO_UI.comp[dbVal] ?? dbVal ?? "Compensación N/A";

/* ---------- IconButtons (mismo look que Mis prácticas) ---------- */
function IconBtn({ title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 36,
        height: 36,
        borderRadius: 999,
        border: "1px solid #d6d8df",
        background: "#fff",
        color: "#1F3354",
        cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)"
      }}
    >
      {children}
    </button>
  );
}

function IconBookmark({ active = false }) {
  if (active) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path fill="#2563eb" d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="var(--color-principal)"
        strokeWidth="2"
        d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function IconBan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1F3354"
        d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm5.657 15.657A8 8 0 1 1 20 12a7.95 7.95 0 0 1-2.343 5.657ZM7.05 7.05 16.95 16.95"
        stroke="#1F3354"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- Página ---------- */
export default function EstudiantesPage() {
  const router = useRouter();
  const reqSeq = useRef(0);

  // Buscador y filtros
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");
  const [filters, setFilters] = useState({ modalidad: "", comp: "", idioma: "" });

  // Datos
  const [vacancies, setVacancies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Paginación
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [hasMore, setHasMore] = useState(true);

  // Usuario/favoritos/ocultas
  const [userId, setUserId] = useState(null);
  const [favIds, setFavIds] = useState([]);    // uuid[]
  const [hiddenIds, setHiddenIds] = useState([]); // uuid[]

  /* ----- Boot: usuario + favoritos + ocultas ----- */
  useEffect(() => {
    let ignore = false;
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || ignore) return;
      setUserId(user.id);

      const [{ data: favData }, { data: hidData }] = await Promise.all([
        supabase.from("vacancy_favorites").select("vacancy_id").eq("student_id", user.id).limit(500),
        supabase.from("vacancy_hidden").select("vacancy_id").eq("student_id", user.id).limit(500),
      ]);

      if (!ignore && favData) setFavIds(favData.map((x) => x.vacancy_id));
      if (!ignore && hidData) setHiddenIds(hidData.map((x) => x.vacancy_id));
    };
    boot();
    return () => { ignore = true; };
  }, []);

  /* ----- Carga de vacantes (excluye ocultas) ----- */
  useEffect(() => {
    const fetchData = async () => {
      const myId = ++reqSeq.current;
      setLoading(true);
      setErrorMsg("");

      // 1) pre-búsqueda de empresas por nombre (si hay q)
      let companyIds = [];
      if (q) {
        const safeQ = String(q).replace(/[%*(),"]/g, " ").trim();
        const { data: compHits } = await supabase
          .from("companies")
          .select("id")
          .ilike("name", `%${safeQ}%`)
          .limit(50);
        if (myId !== reqSeq.current) return;
        if (compHits?.length) companyIds = compHits.map((c) => c.id);
      }

      // 2) query base (SIN expires_at y SIN MAX_SAFE_INTEGER)
      let query = supabase
        .from("vacancies")
        .select(`
          id, title, modality, compensation, language, requirements, activities,
          location_text, rating_avg, rating_count, status, created_at, company_id,
          spots_total, spots_taken, spots_left,
          company:companies!left ( id, name, industry, logo_url )
        `)
        .eq("status", "active")
        // cupo disponible real
        .gt("spots_left", 0);

      // 3) texto libre
      if (q) {
        const safe = String(q).replace(/[\*\(\)",]/g, " ").trim();
        const likeStar = `*${safe}*`;
        const parts = [`title.ilike.${likeStar}`, `location_text.ilike.${likeStar}`];
        if (companyIds.length) {
          const csv = `(${companyIds.map(id => `"${id}"`).join(",")})`;
          parts.push(`company_id.in.${csv}`);
        }
        query = query.or(parts.join(","));
      }

      // 4) locación
      if (loc) query = query.ilike("location_text", `%${loc}%`);

      // 5) filtros exactos
      const dbMod = mapUIToDB_mod(filters.modalidad);
      if (dbMod) query = query.eq("modality", dbMod);

      if (filters.comp) {
        const k = norm(filters.comp);
        if (k === "apoyo economico") query = query.in("compensation", COMP_VARIANTS.apoyo);
        else if (k === "sin apoyo") query = query.in("compensation", COMP_VARIANTS.sin);
      }

      if (filters.idioma) query = query.eq("language", filters.idioma);

      // 6) excluir ocultas (UUIDs entre comillas)
      if (hiddenIds.length) {
        const csvHidden = `(${hiddenIds.map(id => `"${id}"`).join(",")})`;
        query = query.not("id", "in", csvHidden);
      }

      // 7) orden + paginación
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error } = await query;
      if (myId !== reqSeq.current) return;

      if (error) {
        setErrorMsg(error.message || "Error al cargar vacantes.");
        setVacancies([]);
        setSelected(null);
        setHasMore(false);
      } else {
        setVacancies(data || []);
        setSelected((data && data[0]) || null);
        setHasMore((data || []).length === PAGE_SIZE);
      }

      setLoading(false);
    };

    fetchData();
  }, [q, loc, filters, page, hiddenIds]);

  /* ----- Actions: favoritos / ocultas ----- */
  const toggleFavorite = async (vacancyId) => {
    if (!userId) return;
    try {
      if (favIds.includes(vacancyId)) {
        const { error } = await supabase
          .from("vacancy_favorites")
          .delete()
          .eq("student_id", userId)
          .eq("vacancy_id", vacancyId);
        if (error) throw error;
        setFavIds((prev) => prev.filter((id) => id !== vacancyId));
      } else {
        const { error } = await supabase
          .from("vacancy_favorites")
          .insert({ student_id: userId, vacancy_id: vacancyId });
        if (error) throw error;
        setFavIds((prev) => [...prev, vacancyId]);
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo actualizar favoritos.");
    }
  };

  const toggleHidden = async (vacancyId) => {
    if (!userId) return;
    try {
      if (hiddenIds.includes(vacancyId)) {
        const { error } = await supabase
          .from("vacancy_hidden")
          .delete()
          .eq("student_id", userId)
          .eq("vacancy_id", vacancyId);
        if (error) throw error;
        setHiddenIds((prev) => prev.filter((id) => id !== vacancyId));
      } else {
        const { error: hideErr } = await supabase
          .from("vacancy_hidden")
          .insert({ student_id: userId, vacancy_id: vacancyId });
        if (hideErr) throw hideErr;

        if (favIds.includes(vacancyId)) {
          const { error: favDelErr } = await supabase
            .from("vacancy_favorites")
            .delete()
            .eq("student_id", userId)
            .eq("vacancy_id", vacancyId);
          if (favDelErr) throw favDelErr;
          setFavIds((prev) => prev.filter((id) => id !== vacancyId));
        }
        setHiddenIds((prev) => [...prev, vacancyId]);

        if (selected?.id === vacancyId) {
          const next = vacancies.find(
            (v) => v.id !== vacancyId && !hiddenIds.includes(v.id)
          );
          setSelected(next || null);
        }
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo actualizar la visibilidad.");
    }
  };

  /* ----- Helpers ----- */
  const filtered = useMemo(() => vacancies, [vacancies]);

  return (
    <>
      <Navbar />

      <main className="jobs-wrap">
        {/* Buscador principal */}
        <div className="jobs-searchbar">
          <div className="jobs-input">
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
            </svg>
            <input
              value={q}
              onChange={(e) => { setPage(0); setQ(e.target.value); }}
              placeholder="Título del empleo, palabras clave o empresa"
            />
          </div>

          <div className="jobs-input">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M12 2A7 7 0 0 0 5 9c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"
              />
            </svg>
            <input
              value={loc}
              onChange={(e) => { setPage(0); setLoc(e.target.value); }}
              placeholder="Ciudad/colonia (p. ej., Ciudad Juárez)"
            />
          </div>

          <button className="jobs-searchbtn" onClick={() => setPage(0)} aria-label="Buscar empleos">
            Buscar empleos
          </button>
        </div>

        {/* Filtros */}
        <div className="jobs-filters">
          <Pill
            label="Modalidad"
            value={filters.modalidad}
            onChange={(v) => { setPage(0); setFilters((s) => ({ ...s, modalidad: v })); }}
            options={MODALIDADES}
          />
          <Pill
            label="Compensación"
            value={filters.comp}
            onChange={(v) => { setPage(0); setFilters((s) => ({ ...s, comp: v })); }}
            options={COMPENSACIONES}
          />
          <Pill
            label="Idioma"
            value={filters.idioma}
            onChange={(v) => { setPage(0); setFilters((s) => ({ ...s, idioma: v })); }}
            options={IDIOMAS}
          />
        </div>

        {/* Grid principal */}
        <section className="jobs-grid">
          {/* Listado */}
          <aside className="jobs-listing">
            {loading && (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="jobs-card sk" key={i} />
                ))}
              </>
            )}

            {!loading &&
              filtered.map((v) => {
                const isFav = favIds.includes(v.id);
                const isHidden = hiddenIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    className={`jobs-card ${selected?.id === v.id ? "is-active" : ""}`}
                    onClick={() => {
                      if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
                        router.push(`/alumno/vacante/${v.id}`);
                      } else {
                        setSelected(v);
                      }
                    }}
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

                        {/* Acciones (favorito / ocultar) */}
                        <div className="jobs-card-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <IconBtn
                            title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                            onClick={() => toggleFavorite(v.id)}
                          >
                            <IconBookmark active={isFav} />
                          </IconBtn>

                          <IconBtn
                            title={isHidden ? "Mostrar esta vacante" : "Ocultar esta vacante"}
                            onClick={() => toggleHidden(v.id)}
                          >
                            <IconBan active={isHidden} />
                          </IconBtn>
                        </div>
                      </div>

                      <div className="jobs-meta">
                        <span>{fmtMod(v.modality)}</span>
                        <span>{fmtComp(v.compensation)}</span>
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
                    </div>
                  </button>
                );
              })}

            {!loading && hasMore && (
              <button className="jobs-more" onClick={() => setPage((p) => p + 1)}>
                Cargar más
              </button>
            )}

            {!loading && !filtered.length && (
              <div className="jobs-empty small">Sin resultados con esos filtros.</div>
            )}
          </aside>

          {/* Detalle (sticky en desktop) */}
          <article className="jobs-detail">
            {loading && <div className="jobs-skeleton">Cargando…</div>}

            {!loading && !selected && <div className="jobs-empty">No se encontró la vacante</div>}

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

                  {/* Acciones en detalle */}
                  {(() => {
                    const isFav = favIds.includes(selected.id);
                    const isHidden = hiddenIds.includes(selected.id);
                    return (
                      <div className="jobs-card-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <IconBtn
                          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                          active={isFav}
                          onClick={() => toggleFavorite(selected.id)}
                        >
                          <IconBookmark active={isFav} />
                        </IconBtn>

                        <IconBtn
                          title={isHidden ? "Mostrar esta vacante" : "Ocultar esta vacante"}
                          active={isHidden}
                          onClick={() => toggleHidden(selected.id)}
                        >
                          <IconBan />
                        </IconBtn>
                      </div>
                    );
                  })()}
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
                      {splitLines(selected.activities).map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {selected.requirements && (
                  <section className="jobs-section">
                    <h3>Requisitos</h3>
                    <ul className="jobs-list">
                      {splitLines(selected.requirements).map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="jobs-cta">
                  <button className="jobs-apply">Postularse ahora</button>
                </div>

                <div className="jobs-map">
                  <img src="/img/mapa_demo.png" alt="Mapa" />
                </div>
              </div>
            )}
          </article>
        </section>

        {errorMsg && <div className="jobs-error">{errorMsg}</div>}
      </main>

      <Footer />
    </>
  );
}

/* --------- Helpers / mini componentes ---------- */
function splitLines(text) {
  const arr = String(text || "")
    .split(/\r?\n|•|- /)
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : ["No disponible"];
}

function Pill({ label, value, options = [], onChange }) {
  return (
    <label className="jobs-pill">
      <span className="lbl">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stars({ rating = 0, compact = false }) {
  const r = Math.round(Number(rating || 0));
  const full = "★★★★★".slice(0, r);
  const empty = "★★★★★".slice(r);
  return (
    <span className={`jobs-stars ${compact ? "small" : ""}`} aria-label={`Calificación ${r} de 5`}>
      <span className="full">{full}</span>
      <span className="empty">{empty}</span>
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
