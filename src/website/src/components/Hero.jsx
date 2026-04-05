import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, Wrench, Gamepad2, Github } from 'lucide-react'

export default function Hero() {
  const features = [
    {
      icon: Download,
      title: 'Downloader',
      description: 'Multi-platform media downloader for videos, audio, and images.',
    },
    {
      icon: Wrench,
      title: 'Tools',
      description: 'Useful utility tools for everyday tasks and automation.',
    },
    {
      icon: Gamepad2,
      title: 'Game',
      description: 'Fun mini-games and entertainment APIs for your projects.',
    },
  ]

  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-900 parallax-bg">
      {/* Background Decoration with 3D effect */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary-100/50 dark:from-primary-900/20 to-transparent rounded-full blur-3xl opacity-50 parallax-element" style={{transform: 'translateZ(50px)'}} />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-gradient-to-l from-accent-100/30 dark:from-accent-900/10 to-transparent rounded-full blur-3xl opacity-40 parallax-element" style={{transform: 'translateZ(30px)'}} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center animate-fade-in">
          {/* Badge with 3D effect */}
          <div className="inline-flex items-center space-x-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8 card-3d depth-shadow">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
            <span>Version 1.0.0 is now available</span>
          </div>

          {/* Heading with float animation */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight float-3d">
            Masukkan Nama API
            <br />
            <span className="text-gradient">API untuk Developer</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto">
            API ringan dan gratis untuk downloader, tools, dan utility.
            Dokumentasi simpel, mudah dipakai, dan developer-friendly.
          </p>

          {/* CTAs with 3D effect */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/docs" className="btn-primary text-base px-8 py-3 group card-3d depth-shadow">
              Go to Docs
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://github.com/username/repository"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-base px-8 py-3 card-3d depth-shadow"
            >
              <Github size={18} className="mr-2 inline" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features Grid with 3D effect */}
        <div className="mt-24 grid md:grid-cols-3 gap-6 perspective-3d">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="card-3d card-hover p-6 animate-slide-up depth-shadow"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="card-3d-inner">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <feature.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
