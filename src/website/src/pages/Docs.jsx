import React, { useState, useEffect, useCallback } from 'react'
import { Menu } from 'lucide-react'
import docsData from '../data/docs.json'
import DocsSidebar from '../components/DocsSidebar'
import DocsContent from '../components/DocsContent'

export default function Docs() {
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('')
  const [activeEndpoint, setActiveEndpoint] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    // Load docs data
    setCategories(docsData)
    if (docsData.length > 0) {
      setActiveCategory(docsData[0].id)
      if (docsData[0].endpoints.length > 0) {
        setActiveEndpoint(docsData[0].endpoints[0].id)
      }
    }
  }, [])

  const handleCategoryChange = useCallback((categoryId, endpointId = null) => {
    setActiveCategory(categoryId)
    if (endpointId) {
      setActiveEndpoint(endpointId)
    } else {
      const category = categories.find((c) => c.id === categoryId)
      if (category && category.endpoints.length > 0) {
        setActiveEndpoint(category.endpoints[0].id)
      }
    }
  }, [categories])

  const getActiveCategory = useCallback(() => {
    return categories.find((c) => c.id === activeCategory) || null
  }, [categories, activeCategory])

  const getActiveEndpoint = useCallback(() => {
    const category = getActiveCategory()
    if (!category) return null
    return category.endpoints.find((e) => e.id === activeEndpoint) || null
  }, [getActiveCategory, activeEndpoint])

  const handleCopyRequest = useCallback((endpoint) => {
    // Generate curl command
    const curl = `curl -X ${endpoint.method} "https://api.masukkan-nama.com${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      const params = endpoint.parameters
        .map((p) => `  -d "${p.name}=${p.type === 'string' ? 'value' : '123'}"`)
        .join(' \\\n')
      navigator.clipboard.writeText(`${curl} \\\n${params}`)
    } else {
      navigator.clipboard.writeText(curl)
    }
  }, [])

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-30 btn-primary shadow-lg"
      >
        <Menu size={20} className="mr-2" />
        Menu
      </button>

      {/* Sidebar */}
      <DocsSidebar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 lg:overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Docs Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Dokumentasi API
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Referensi lengkap untuk semua endpoint yang tersedia.
            </p>
          </div>

          {/* Content */}
          <DocsContent
            category={getActiveCategory()}
            endpoint={getActiveEndpoint()}
            onCopyRequest={handleCopyRequest}
          />
        </div>
      </main>
    </div>
  )
}
