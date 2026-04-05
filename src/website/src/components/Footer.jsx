import React from 'react'
import { Github, Mail, Globe } from 'lucide-react'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  const links = {
    social: [
      { icon: Github, href: 'https://github.com/username', label: 'GitHub' },
      { icon: Mail, href: 'mailto:contact@email.com', label: 'Email' },
      { icon: Globe, href: 'https://website.com', label: 'Website' },
    ],
    docs: [
      { label: 'Getting Started', href: '/docs' },
      { label: 'Downloader API', href: '/docs#downloader' },
      { label: 'Tools API', href: '/docs#tools' },
      { label: 'Game API', href: '/docs#game' },
    ],
    resources: [
      { label: 'GitHub Repository', href: 'https://github.com/username/repository' },
      { label: 'Report Issue', href: 'https://github.com/username/repository/issues' },
      { label: 'Changelog', href: 'https://github.com/username/repository/releases' },
    ],
  }

  return (
    <footer className="bg-white border-t border-slate-200 dark:bg-slate-800 dark:border-slate-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="font-semibold text-lg text-slate-900 dark:text-white">Masukkan Nama API</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              API ringan dan gratis untuk developer Indonesia.
            </p>
            {/* Social Links */}
            <div className="flex items-center space-x-3">
              {links.social.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  aria-label={social.label}
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Documentation Links */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Dokumentasi</h4>
            <ul className="space-y-2">
              {links.docs.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              {links.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {currentYear} Masukkan Nama API. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 text-sm text-slate-400 dark:text-slate-500">
              <a href="/privacy" className="hover:text-slate-600 dark:hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-slate-600 dark:hover:text-white transition-colors">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
