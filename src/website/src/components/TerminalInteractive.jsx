import React, { useState, useRef, useEffect } from 'react'
import { Terminal, ChevronRight, Copy, Check } from 'lucide-react'

export default function TerminalInteractive({ method, endpoint, defaultParams = {} }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState(null)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)

  const baseUrl = 'https://api.masukkan-nama.com'

  // Generate full curl command with params
  const getFullCommand = () => {
    let cmd = `curl -X ${method} "${baseUrl}${endpoint}"`
    const params = Object.entries(defaultParams)
      .filter(([, v]) => v)
      .map(([k, v]) => `-d "${k}=${v}"`)
    if (params.length > 0) {
      cmd += ` \\\n  ${params.join(' \\\n  ')}`
    }
    return cmd
  }

  const handleExecute = async () => {
    if (!input.trim()) return

    setIsLoading(true)
    setOutput(null)

    try {
      // Parse the input command to extract params
      const urlMatch = input.match(/-X\s+(\w+)\s+["']([^"']+)["']/)
      if (urlMatch) {
        const url = urlMatch[2]
        const response = await fetch(url, {
          method: urlMatch[1],
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        setOutput(data)
      }
    } catch (err) {
      setOutput({ error: 'Failed to execute command', message: err.message })
    }

    setIsLoading(false)
  }

  const copyCommand = async () => {
    await navigator.clipboard.writeText(input || getFullCommand())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleExecute()
    }
  }

  useEffect(() => {
    // Auto-focus on mount
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  return (
    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg border border-slate-700 dark:border-slate-700 overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-700">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/80" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <span className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs font-mono text-slate-400">terminal</span>
      </div>

      {/* Terminal Body */}
      <div className="p-4 space-y-3">
        {/* Command Input */}
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono text-sm">$</span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getFullCommand()}
              className="w-full bg-transparent text-slate-200 font-mono text-sm outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={copyCommand}
            className="p-1 rounded hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors"
            title="Copy command"
          >
            {copied ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} className="text-slate-400" />
            )}
          </button>
          <button
            onClick={handleExecute}
            disabled={isLoading}
            className="p-1 rounded hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Execute command"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin block" />
            ) : (
              <ChevronRight size={14} className="text-slate-400" />
            )}
          </button>
        </div>

        {/* Output */}
        {output && (
          <div className="mt-4 pt-3 border-t border-slate-700">
            <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
