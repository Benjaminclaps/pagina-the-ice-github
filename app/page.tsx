import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col w-full bg-white">
      {/* HEADER */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">LUXE CONDES</h1>
          <nav className="hidden md:flex gap-8 text-gray-700">
            <a href="#propiedades" className="hover:text-blue-600">Propiedades</a>
            <a href="#contacto" className="hover:text-blue-600">Contacto</a>
          </nav>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative w-full h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex items-center justify-center pt-16">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="https://images.unsplash.com/photo-1545324418-cc1a9cf6efdd?w=1200&h=600&fit=crop"
            alt="Departamentos Las Condes"
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative z-10 text-center text-white max-w-2xl px-6">
          <h2 className="text-5xl font-bold mb-4">Departamentos de Lujo en Las Condes</h2>
          <p className="text-xl mb-8 text-blue-100">
            Vive la experiencia de un hogar moderno con las mejores vistas de la ciudad
          </p>
          <a
            href="#contacto"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition"
          >
            Agendar Visita
          </a>
        </div>
      </section>

      {/* PROPIEDADES DESTACADAS */}
      <section id="propiedades" className="max-w-6xl mx-auto py-20 px-6">
        <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Nuestros Proyectos</h2>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Propiedad 1 */}
          <div className="bg-gray-50 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition">
            <Image
              src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=500&h=300&fit=crop"
              alt="Proyecto A"
              width={500}
              height={300}
              className="w-full h-64 object-cover"
            />
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-2 text-gray-900">Proyecto Downtown</h3>
              <p className="text-gray-600 mb-4">2 y 3 dormitorios • 80 a 150 m²</p>
              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <p>✓ Piscina y gym</p>
                <p>✓ Estacionamiento incluido</p>
                <p>✓ Vista a la cordillera</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">UF 4.500 - 7.500</p>
            </div>
          </div>

          {/* Propiedad 2 */}
          <div className="bg-gray-50 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition">
            <Image
              src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=500&h=300&fit=crop"
              alt="Proyecto B"
              width={500}
              height={300}
              className="w-full h-64 object-cover"
            />
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-2 text-gray-900">Proyecto Premier</h3>
              <p className="text-gray-600 mb-4">3 y 4 dormitorios • 150 a 250 m²</p>
              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <p>✓ Terraza privada</p>
                <p>✓ Home office</p>
                <p>✓ Seguridad 24/7</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">UF 7.200 - 11.000</p>
            </div>
          </div>

          {/* Propiedad 3 */}
          <div className="bg-gray-50 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition">
            <Image
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&h=300&fit=crop"
              alt="Proyecto C"
              width={500}
              height={300}
              className="w-full h-64 object-cover"
            />
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-2 text-gray-900">Proyecto Ejecutivo</h3>
              <p className="text-gray-600 mb-4">1 y 2 dormitorios • 50 a 90 m²</p>
              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <p>✓ Cocina integrada</p>
                <p>✓ Áreas comunes modernas</p>
                <p>✓ Acceso a metro</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">UF 2.800 - 4.200</p>
            </div>
          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section className="bg-blue-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Por qué elegir Luxe Condes</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="flex gap-4">
              <div className="text-3xl">🏗️</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Construcción Premium</h3>
                <p className="text-gray-700">Materiales de primera calidad y acabados modernos en cada proyecto.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-3xl">📍</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Ubicación Estratégica</h3>
                <p className="text-gray-700">Centro financiero de Santiago con acceso a todas las amenidades.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-3xl">💰</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Opciones de Financiamiento</h3>
                <p className="text-gray-700">Planes flexibles y convenios con los principales bancos del país.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-3xl">🏅</div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">Garantía y Certeza</h3>
                <p className="text-gray-700">20 años de trayectoria en el mercado inmobiliario de Santiago.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="max-w-4xl mx-auto py-20 px-6 w-full">
        <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">Contáctanos</h2>

        <form className="bg-gray-50 p-8 rounded-lg shadow-lg space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Nombre</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Teléfono</label>
              <input
                type="tel"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tu teléfono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Proyecto de Interés</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option>Selecciona un proyecto</option>
              <option>Proyecto Downtown</option>
              <option>Proyecto Premier</option>
              <option>Proyecto Ejecutivo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Mensaje</label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Cuéntanos qué buscas..."
            ></textarea>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
          >
            Enviar Consulta
          </button>
        </form>

        <div className="mt-12 grid md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600 mb-2">📞</p>
            <p className="font-bold text-gray-900">+56 2 2000 0000</p>
            <p className="text-gray-600 text-sm">Lunes a viernes 9-18h</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600 mb-2">📧</p>
            <p className="font-bold text-gray-900">ventas@luxecondes.cl</p>
            <p className="text-gray-600 text-sm">Respuesta en 2 horas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600 mb-2">📍</p>
            <p className="font-bold text-gray-900">Av. El Golf 99, Las Condes</p>
            <p className="text-gray-600 text-sm">Visita nuestra oficina</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-8 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p>© 2024 Luxe Condes. Todos los derechos reservados.</p>
          <p className="text-gray-400 text-sm mt-2">Proyecto inmobiliario en construcción</p>
        </div>
      </footer>
    </div>
  );
}
