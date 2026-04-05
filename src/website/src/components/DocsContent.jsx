import React from 'react'
import { Copy, ExternalLink, Play } from 'lucide-react'
import CodeBlock, { RequestTabs } from './CodeBlock'
import TerminalInteractive from './TerminalInteractive'

export default function DocsContent({ category, endpoint, onCopyRequest }) {
  if (!category || !endpoint) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Select an endpoint from the sidebar
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
        <span>{category.title}</span>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-medium">{endpoint.name}</span>
      </div>

      {/* Endpoint Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{endpoint.name}</h1>
          <MethodBadge method={endpoint.method} />
          {endpoint.deprecated && (
            <span className="badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">Deprecated</span>
          )}
        </div>
        <code className="text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-mono">
          {endpoint.path}
        </code>
        <p className="mt-4 text-slate-600 dark:text-slate-400">{endpoint.description}</p>
      </div>

      {/* Parameters */}
      {endpoint.parameters && endpoint.parameters.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Parameters</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Required</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 dark:text-slate-400">Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.parameters.map((param) => (
                  <tr key={param.name} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <code className="text-primary-600 dark:text-primary-400 font-mono text-sm">{param.name}</code>
                      {param.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{param.type}</td>
                    <td className="py-3 px-4">
                      {param.required ? (
                        <span className="badge bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">Required</span>
                      ) : (
                        <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Optional</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Request Examples */}
      {endpoint.exampleRequest && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Request Examples</h2>

          {/* Interactive Terminal */}
          <TerminalInteractive
            method={endpoint.method}
            endpoint={endpoint.path}
          />

          {endpoint.exampleRequest.tabs ? (
            <RequestTabs tabs={endpoint.exampleRequest.tabs} method={endpoint.method} />
          ) : (
            <CodeBlock
              code={endpoint.exampleRequest.curl || endpoint.exampleRequest.code}
              language={endpoint.exampleRequest.language || 'curl'}
              method={endpoint.method}
            />
          )}

          {/* Try in Browser Button */}
          <button
            onClick={() => onCopyRequest && onCopyRequest(endpoint)}
            className="mt-3 inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            <Play size={16} />
            Copy as cURL
          </button>
        </section>
      )}

      {/* Response */}
      {endpoint.exampleResponse && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Response</h2>
          <CodeBlock code={JSON.stringify(endpoint.exampleResponse, null, 2)} language="json" />
        </section>
      )}

      {/* Notes */}
      {endpoint.notes && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notes</h2>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
              {endpoint.notes.map((note, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-amber-500 dark:text-amber-400 mt-0.5">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Rate Limit */}
      {endpoint.rateLimit && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Rate Limit</h2>
          <div className="card p-4 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <ClockIcon className="w-5 h-5 text-primary-500 dark:text-primary-400" />
              <span className="font-medium text-slate-900 dark:text-white">
                {endpoint.rateLimit.requests} requests / {endpoint.rateLimit.period}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{endpoint.rateLimit.description}</p>
          </div>
        </section>
      )}
    </div>
  )
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    POST: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    PUT: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    DELETE: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    PATCH: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  }

  return (
    <span className={`badge border ${colors[method] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700'} font-mono text-xs`}>
      {method}
    </span>
  )
}

function ClockIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
