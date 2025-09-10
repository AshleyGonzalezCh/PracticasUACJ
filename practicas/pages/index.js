import Navbar from '../components/navbar';
import Footer from '../components/footer';
import Slider from "../components/slider";
import InfoPanel from '@/components/InfoPanel';
import Link from 'next/link';

const infoCards = [
  {
    id: 1,
    title: "Procedimiento para registrar prácticas profesionales.",
    image: "/img/ER_01.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aquí puedes poner imágenes y mucho texto si quieres."
  },
  {
    id: 2,
    title: "Procedimiento para las empresas.",
    image: "/img/ER_02.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris et risus nec dui dictum viverra."
  },
  {
    id: 3,
    title: "Compensaciones",
    image: "/img/ER_03.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis nec felis libero."
  },
  {
    id: 4,
    title: "Cierre por registro.",
    image: "/img/ER_04.jpg",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec commodo nulla ac odio facilisis."
  },
  {
    id: 5,
    title: "Prácticas profesionales por reconocimiento.",
    image: "/img/ER_05.jpg",
    description: "Jesucristo redentor ayudame aaaaaa"
  },
];



export default function Home() {
  return (
    <>
      <Navbar />

      {/* Header / Slider */}
      <header>
        <Slider />
      </header>

      <div className='Contenedor'>
        {/* Panel de acceso */}
        <div className="section-container">
          <h2 className="section-title">Panel de Acceso</h2>

          <section className="cards-section">
            {/* Estudiantes → /login */}
            <Link href="/login" className="card" style={{ backgroundImage: "url('/img/Estudiantes.jpg')" }}>
              <div className="card-overlay">
                <h3>Portal de Estudiante</h3>
                <p>Administre sus grupos y acceda al registro de proyectos para agregar o editar información de las vacantes.</p>
              </div>
            </Link>

            {/* Profesores → /login */}
            <Link href="/login" className="card" style={{ backgroundImage: "url('/img/Profesores.jpg')" }}>
              <div className="card-overlay">
                <h3>Portal de Profesores</h3>
                <p>Acceda a la lista de proyectos disponibles y envíe su solicitud de prácticas profesionales.</p>
              </div>
            </Link>

            {/* Reglamento → externo en nueva pestaña */}
            <a
              href="https://TU-URL-REAL-DEL-REGLAMENTO"
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              style={{ backgroundImage: "url('/img/Reglamento.jpg')" }}
            >
              <div className="card-overlay">
                <h3>Reglamento</h3>
                <p>Consulta las normas y lineamientos que regulan el proceso de prácticas profesionales.</p>
              </div>
            </a>
          </section>
        </div>

        {/* Datos duros */}
        <section className="datos-duros">
          <div className="datos-duros">
            <div className="dato">
              <h3>+500</h3>
              <p>Empresas registradas</p>
              <span>Colaboradores que confían en la formación de los alumnos en la UACJ.</span>
            </div>

            <div className="dato">
              <h3>+830</h3>
              <p>Estudiantes activos</p>
              <span>Con acceso a la lista de vacantes para su licenciatura.</span>
            </div>

            <div className="dato">
              <h3>+10</h3>
              <p>Convenios vigentes</p>
              <span>Acuerdos con empresas y organismos.</span>
            </div>

            <div className="dato">
              <h3>+1500</h3>
              <p>Vacantes publicadas</p>
              <span>Conectando estudiantes con diversas oportunidades laborales.</span>
            </div>
          </div>
        </section>

        {/* Año */}
        <div className="Año">
          <h2>2025.2</h2>
        </div>

        {/* Más información */}
        <div className="section-container-fondo-imagen">
          <div className="overlay">
            <h2>¿Qué son las prácticas profesionales?</h2>
            <p>
              Son una estrategia institucional que se adapta a la naturaleza y necesidades de los programas educativos,
              propiciando en las y los estudiantes diversas actividades de aprendizaje y experiencia en el ámbito profesional
              dentro de su formación.
            </p>
            <button className="btn-leer-mas">Leer más</button>
          </div>
        </div>

        {/* Panel de empresas */}

        <div className="contenedor-cards-empresas">
          <h2 className="section-title-fondo">Empresas con vinculación a la UACJ</h2>
          <section className="cards-section empresas">
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo1.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo2.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo3.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo4.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo5.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo1.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo2.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo3.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo4.png')" }}></div>
            <div className="card logo-card" style={{ backgroundImage: "url('/img/logo5.png')" }}></div>
          </section>
        </div>


        {/* Información relacionada */}
        <div className="section-container">
          <h2 className="section-title">Información relacionada.</h2>
            <section className="cards-section">
              {infoCards.map((card) => (
                <InfoPanel key={card.id} card={card} />
              ))}
            </section>
        </div>

      </div>

      <Footer />
    </>
  );
}
