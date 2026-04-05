import React, { useState, useMemo } from 'react'
import { Search, Menu, X } from 'lucide-react'

export default function DocsSidebar({ categories, activeCategory, onCategoryChange, isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories

    return categories.map((cat) => ({
      ...cat,
      endpoints: cat.endpoints.filter(
        (ep) =>
          ep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter((cat) => cat.endpoints.length > 0)
  }, [categories, searchQuery])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-16 left-0 z-40 lg:z-0 w-72 h-[calc(100vh-4rem)] bg-white dark:bg-slate-900 border-r lg:border-r-0 border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header - Mobile Only */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Dokumentasi</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          {/* Categories Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 pt-0 space-y-4">
            {filteredCategories.map((category) => (
              <div key={category.id} className="category-group">
                <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">
                  {category.title}
                </h3>
                <ul className="space-y-1">
                  {category.endpoints.map((endpoint) => (
                    <li key={endpoint.id}>
                      <button
                        onClick={() => {
                          onCategoryChange(category.id, endpoint.id)
                          onClose()
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          activeCategory === category.id
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MethodBadge method={endpoint.method} />
                          <span className="truncate">{endpoint.name}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                No endpoints found
              </div>
            )}
          </nav>
        </div>
      </aside>
    </>
  )
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
    POST: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
    PUT: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
    DELETE: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    PATCH: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  }

  return (
    <span className={`badge text-xs font-mono ${colors[method] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'}`}>
      {method}
    </span>
  )
}
