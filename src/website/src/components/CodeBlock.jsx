import React, { useState } from 'react'
import { Copy, Check, Terminal, FileCode, ChevronDown, ChevronUp } from 'lucide-react'

export default function CodeBlock({ code, language = 'curl', showLanguage = true, method }) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const methodColors = {
    GET: {
      header: 'bg-emerald-500/20 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    },
    POST: {
      header: 'bg-amber-500/20 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border-amber-500/30',
      badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    },
    PUT: {
      header: 'bg-blue-500/20 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-500/30',
      badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
    },
    DELETE: {
      header: 'bg-red-500/20 dark:bg-red-900/40 text-red-600 dark:text-red-400 border-red-500/30',
      badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    },
    PATCH: {
      header: 'bg-purple-500/20 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border-purple-500/30',
      badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
    },
  }

  const colors = method ? methodColors[method] : null

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getLanguageLabel = (lang) => {
    const labels = {
      curl: 'cURL',
      javascript: 'JavaScript',
      python: 'Python',
      nodejs: 'Node.js',
      php: 'PHP',
    }
    return labels[lang] || lang
  }

  const formatCode = (codeStr) => {
    try {
      const parsed = JSON.parse(codeStr)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return codeStr
    }
  }

  const isJson = language === 'json' || code.trim().startsWith('{') || code.trim().startsWith('[')
  const displayCode = isJson ? formatCode(code) : code

  return (
    <div className={`code-block my-4 border ${colors ? colors.header : 'border-slate-700 dark:border-slate-700'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2 ${colors ? '' : 'bg-slate-800 dark:bg-slate-950'} ${colors ? colors.header : 'text-slate-300 dark:text-slate-400'}`}>
        <div className="flex items-center gap-3">
          {/* Terminal Dots */}
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          {/* Method Badge */}
          {method && (
            <span className={`badge font-mono text-xs ${colors.badge}`}>
              {method}
            </span>
          )}
          {/* Language Label */}
          {showLanguage && !method && (
            <span className="text-xs font-mono flex items-center gap-1">
              {language === 'curl' ? <Terminal size={14} /> : <FileCode size={14} />}
              {getLanguageLabel(language)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={copyToClipboard}
            className="p-1 rounded hover:bg-slate-700 dark:hover:bg-slate-800 transition-colors"
            aria-label="Copy to clipboard"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Code */}
      {isExpanded && (
        <pre className="p-4 overflow-x-auto max-h-96 overflow-y-auto bg-slate-900 dark:bg-slate-950">
          <code className={`text-sm font-mono whitespace-pre-wrap break-all leading-relaxed ${
            isJson
              ? 'text-green-300 dark:text-green-300'
              : 'text-slate-200 dark:text-slate-200'
          }`}>
            {displayCode}
          </code>
        </pre>
      )}
    </div>
  )
}

export function RequestTabs({ tabs, defaultTab = 'curl', method }) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div className="my-4">
      <div className="flex gap-1 p-1 bg-slate-800 dark:bg-slate-950 rounded-t-lg border-b border-slate-700 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
              activeTab === tab.id
                ? 'bg-slate-700 dark:bg-slate-800 text-white'
                : 'text-slate-400 dark:text-slate-400 hover:text-white dark:hover:text-white hover:bg-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
          <CodeBlock code={tab.code} language={tab.language} method={method} />
        </div>
      ))}
    </div>
  )
}
