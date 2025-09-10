// pages/estudiantes.js
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import StudentNavbar from '../components/navbarEstudiante';
import Footer from '../components/footer';

const MODALIDADES = ['Presencial','Híbrida','Remota'];
const COMPENSACIONES = ['Apoyo económico','Sin apoyo'];
const IDIOMAS = ['ES','EN'];

export default function EstudiantesPage() {
  // UI state
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({
    modalidad: '',
    comp: '',
    idioma: '',
    ubicacion: '',
  });
  const [vacancies, setVacancies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar vacantes (RLS ya filtra por programa del alumno)
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // ejemplo simple; luego refinamos con q/filters
      const { data, error } = await supabase
        .from('vacancies')
        .select(`
          id, title, modality, compensation, language, created_at,
          location_text,
          company:companies(name),
          rating_avg, rating_count
        `)
        .order('created_at', { ascending:false })
        .limit(20);

      if (!error) {
        setVacancies(data || []);
        setSelected((data && data[0]) || null);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Filtro en cliente (rápido para el demo visual)
  const filtered = useMemo(() => {
    return vacancies.filter(v => {
      const txt = `${v.title} ${v.company?.name ?? ''} ${v.location_text ?? ''}`.toLowerCase();
      if (q && !txt.includes(q.toLowerCase())) return false;
      if (filters.modalidad && v.modality !== filters.modalidad) return false;
      if (filters.comp && v.compensation !== filters.comp) return false;
      if (filters.idioma && v.language !== filters.idioma) return false;
      if (filters.ubicacion && !(v.location_text || '').toLowerCase().includes(filters.ubicacion.toLowerCase())) return false;
      return true;
    });
  }, [vacancies, q, filters]);

  return (
    <>
      <StudentNavbar />

      <main className="stu-wrap">
        {/* Buscador */}
        <div className="stu-search">
          <input
            className="stu-search__input"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Diseño Digital"
          />
          <button className="stu-search__btn" aria-label="Buscar">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2"/>
              <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Filtros tipo pill */}
        <div className="stu-filters">
          <Dropdown value={filters.ubicacion} label="Colonia o sector"
            onChange={(v)=>setFilters(s=>({...s, ubicacion:v}))}
            options={['Zona Pronaf','Centro','Las Misiones','Partido Romero']}  />

          <Dropdown value={filters.modalidad} label="Modalidad"
            onChange={(v)=>setFilters(s=>({...s, modalidad:v}))}
            options={MODALIDADES} />

          <Dropdown value={filters.comp} label="Compensación"
            onChange={(v)=>setFilters(s=>({...s, comp:v}))}
            options={COMPENSACIONES} />

          <Dropdown value={filters.idioma} label="Idioma"
            onChange={(v)=>setFilters(s=>({...s, idioma:v}))}
            options={IDIOMAS} />
        </div>

        {/* Layout 2 columnas */}
        <section className="stu-grid">
          {/* Columna izquierda: detalle */}
          <article className="stu-detail">
            {loading && <div className="stu-skeleton">Cargando…</div>}
            {!loading && selected && (
              <>
                <header className="stu-detail__head">
                  <div>
                    <h3>{selected.company?.name || 'Empresa'}</h3>
                    <p className="stu-muted">{selected.title}</p>
                  </div>
                  <StarBadge rating={selected.rating_avg} />
                </header>

                <p className="stu-chipline">
                  <span className="stu-chip">Compensación {selected.compensation || 'N/A'}</span>
                  <span className="stu-chip">Modalidad {selected.modality || 'N/A'}</span>
                  <span className="stu-chip">Idioma {selected.language || 'ES'}</span>
                </p>

                <p className="stu-muted">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                    <path fill="currentColor"
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
                  </svg>
                  {selected.location_text || 'Zona Pronaf, Colonia Margaritas #32564'}
                </p>

                <hr className="stu-sep"/>

                <section className="stu-detail__section">
                  <h4>Actividades</h4>
                  <ul className="stu-list">
                    <li>Apoyo en diseño editorial y diagramación.</li>
                    <li>Preparación de artes finales para impresión.</li>
                    <li>Manejo básico de software CAD.</li>
                  </ul>
                </section>

                <section className="stu-detail__section">
                  <h4>Requisitos</h4>
                  <ul className="stu-list">
                    <li>Portafolio de trabajos.</li>
                    <li>Disponibilidad mínima 20 hrs semanales.</li>
                  </ul>
                </section>

                <section className="stu-detail__section">
                  <h4>Información adicional</h4>
                  <p className="stu-muted">
                    Lic. José Luis Ibáñez-Jiménez · contacto@empresa.mx
                  </p>
                </section>

                <div className="stu-map">
                  {/* En producción pon un mapa real o imagen del lugar */}
                  <img src="/img/mapa_demo.png" alt="Mapa" />
                </div>
              </>
            )}
          </article>

          {/* Columna derecha: listado */}
          <aside className="stu-listing">
            {filtered.map((v) => (
              <button key={v.id}
                      className={`stu-card ${selected?.id === v.id ? 'is-active' : ''}`}
                      onClick={()=>setSelected(v)}>
                <div className="stu-card__leftbar" />
                <div className="stu-card__body">
                  <h5>{v.company?.name || 'EMPRESA MX'}</h5>
                  <StarRow rating={v.rating_avg} />
                  <p className="stu-small">Compensación {v.compensation || 'N/A'}</p>
                  <p className="stu-small">Modalidad {v.modality || 'N/A'}</p>
                  <p className="stu-small stu-location">
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                      <path fill="currentColor"
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
                    </svg>
                    {v.location_text || 'Zona Pronaf, Colonia Margaritas #32564'}
                  </p>
                  <span className="stu-tag">Disponible</span>
                </div>

                <div className="stu-card__bookmark" title="Favorito">
                  {/* placeholder de ícono */}
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path fill="currentColor" d="M6 2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4a2 2 0 0 1 2-2z"/>
                  </svg>
                </div>
              </button>
            ))}
          </aside>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ----------------- Componentes UI pequeñitos  ------------------ */

function Dropdown({ label, value, options = [], onChange }) {
  return (
    <label className="stu-pill">
      <span className="lbl">{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function StarRow({ rating = 4 }) {
  const stars = Math.round(Number(rating || 0));
  return (
    <div aria-label={`Calificación ${stars} de 5`} className="stu-stars" style={{color:'#f5b400', margin:'2px 0 6px'}}>
      {'★★★★★'.slice(0, stars)}<span style={{color:'#ccd3dd'}}>{'★★★★★'.slice(stars)}</span>
    </div>
  );
}
function StarBadge({ rating = 4 }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:6}}>
      <StarRow rating={rating} />
      <span className="stu-muted" style={{fontSize:12}}>({Math.max(7, Math.floor(Math.random()*40))} reseñas)</span>
    </div>
  );
}
