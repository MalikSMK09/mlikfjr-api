import React from 'react'
import { Link } from 'react-router-dom'
import Hero from '../components/Hero'

export default function Home() {
  return (
    <div className="flex flex-col">
      <Hero />

      {/* Quick Start Section */}
      <section className="py-20 bg-white dark:bg-slate-900 perspective-3d">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 float-3d">
              Mulai Sekarang
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Hanya dalam 3 langkah sederhana, kamu sudah bisa menggunakan API kami.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Dapatkan API Key',
                description: 'Daftar gratis danapatkan API key untuk mengakses semua endpoint.',
              },
              {
                step: '02',
                title: 'Baca Dokumentasi',
                description: 'Pelajari cara penggunaan endpoint yang kamu butuhkan.',
              },
              {
                step: '03',
                title: 'Integrasikan',
                description: 'Implementasikan API ke project kamu dengan mudah.',
              },
            ].map((item) => (
              <div key={item.step} className="card-3d card-hover p-6 text-center depth-shadow" style={{animationDelay: `${(item.step * 100)}ms`}}>
                <div className="card-3d-inner">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <span className="text-primary-600 dark:text-primary-400 font-bold">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/docs" className="btn-primary text-base px-8 py-3 card-3d depth-shadow">
              Lihat Dokumentasi
            </Link>
          </div>
        </div>
      </section>

      {/* API Categories Preview */}
      <section className="py-20 bg-slate-50 dark:bg-slate-800/50 perspective-3d">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 float-3d">
              Kategori API
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Berbagai kategori API yang siap kamu gunakan.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Downloader', count: 6, color: 'from-blue-500 to-cyan-500' },
              { name: 'Tools', count: 4, color: 'from-purple-500 to-pink-500' },
              { name: 'Game', count: 3, color: 'from-orange-500 to-red-500' },
              { name: 'Search', count: 2, color: 'from-green-500 to-emerald-500' },
            ].map((category, index) => (
              <Link
                key={category.name}
                to="/docs"
                className="card-3d card-hover p-6 group depth-shadow"
                style={{animationDelay: `${(index * 80)}ms`}}
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className="text-white text-sm font-bold">
                    {category.name[0]}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  {category.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {category.count} endpoints
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Code Preview */}
      <section className="py-20 bg-white dark:bg-slate-900 perspective-3d">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 float-3d">
                Mudah Diintegrasikan
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
                Contoh penggunaan API kami dengan JavaScript. Simpel dan straightforward.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Response dalam format JSON',
                  'Error handling yang jelas',
                  'Rate limit yang transparan',
                  'Dokumentasi lengkap',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-slate-600 dark:text-slate-400 card-3d">
                    <span className="w-5 h-5 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                      <span className="w-2 h-2 bg-primary-500 rounded-full" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/docs" className="btn-primary text-base px-6 py-2.5 card-3d depth-shadow">
                Lihat Contoh Lainnya
              </Link>
            </div>

            <div className="code-block dark:bg-slate-950 dark:border-slate-800 card-3d depth-shadow">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-900 text-slate-300 text-sm">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-2 font-mono">example.js</span>
              </div>
              <pre className="p-4 overflow-x-auto bg-slate-100 dark:bg-slate-950">
                <code className="text-sm font-mono text-blue-600 dark:text-blue-300">
{`const response = await fetch(
  'https://api.masukkan-nama.com/v1/downloader/youtube',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({
      url: 'https://youtube.com/watch?v=...'
    })
  }
);

const data = await response.json();
console.log(data);`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-500 to-accent-500 perspective-3d overflow-hidden relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl parallax-element" style={{transform: 'translateZ(50px)'}} />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 float-3d">
            Siap Memulai?
          </h2>
          <p className="text-lg text-white/80 mb-8">
            Mulai gunakan API kami secara gratis. Tidak perlu kartu kredit.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/docs"
              className="btn bg-white text-primary-600 hover:bg-slate-100 dark:text-primary-600 text-base px-8 py-3 card-3d depth-shadow"
            >
              Get Started
            </Link>
            <a
              href="https://github.com/username/repository"
              target="_blank"
              rel="noopener noreferrer"
              className="btn border-2 border-white/30 text-white hover:bg-white/10 text-base px-8 py-3 card-3d"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
