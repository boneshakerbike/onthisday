'use client'

import { useEffect, useState } from 'react'
import NavTabs from '@/components/nav_tabs'

const CHROME_PROMPT = `Navigate to https://training.coros.com and log in if needed.

Once on the dashboard, find today's daily summary data including:
- Sleep duration and quality
- Resting heart rate
- HRV (Heart Rate Variability)
- SpO2
- Steps
- Training load
- Any workout/activity summaries

Scrape all available metrics and POST them as JSON to:

POST https://8i11.vercel.app/api/coros/save
Headers:
  Content-Type: application/json
  X-Guest-Pin: [YOUR_PIN]

Body:
{
  "date": "YYYY-MM-DD",
  "data": {
    "sleep_duration_min": ...,
    "sleep_quality": ...,
    "resting_hr": ...,
    "hrv": ...,
    "spo2": ...,
    "steps": ...,
    "training_load": ...,
    "workouts": [...],
    ... any other available metrics
  }
}

Use the actual date shown on the COROS dashboard. Include every metric visible on the page.`

function today_str(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function CorosPage() {
  const [date, setDate] = useState(today_str())
  const [row, setRow] = useState<{ date: string; data: Record<string, unknown>; source: string; updated_at: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    document.title = '8i11 | COROS'
  }, [])

  useEffect(() => {
    if (!date) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading/error state must reset synchronously on date change
    setLoading(true)
    setRow(null)
    setError(null)
    fetch(`/api/coros/data?date=${date}`)
      .then(res => {
        if (res.status === 404) return null
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || 'Fetch failed') })
        return res.json()
      })
      .then(data => {
        setRow(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [date])

  const data_entries = row ? Object.entries(row.data as Record<string, unknown>) : []

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-200 p-4">
      <NavTabs />
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-cyan-400 mb-4">COROS</h1>

        <div className="mb-4">
          <label className="text-sm text-gray-400 mr-2">Date:</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-[#0f0f1a] border border-white/20 rounded px-2 py-1 text-gray-200 text-sm"
          />
        </div>

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && row === null && (
          <p className="text-gray-500 text-sm">No data for this date.</p>
        )}

        {row && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Source: {row.source} &bull; Updated: {row.updated_at}</p>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {data_entries.map(([key, val]) => (
                  <tr key={key} className="border-b border-white/10">
                    <td className="py-1 pr-4 text-gray-400 align-top w-1/2">{key}</td>
                    <td className="py-1 text-gray-200 align-top">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => setShowRaw(v => !v)}
              className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline"
            >
              {showRaw ? 'Hide' : 'Show'} raw JSON
            </button>
            {showRaw && (
              <pre className="mt-2 text-xs bg-[#0f0f1a] border border-white/10 rounded p-3 overflow-x-auto text-gray-300">
                {JSON.stringify(row.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="mt-8 border-t border-white/10 pt-4">
          <button
            onClick={() => setShowPrompt(v => !v)}
            className="text-sm text-cyan-400 hover:text-cyan-300 underline"
          >
            {showPrompt ? 'Hide' : 'Show'} Chrome Extension Prompt
          </button>
          {showPrompt && (
            <pre className="mt-3 text-xs bg-[#0f0f1a] border border-white/10 rounded p-3 overflow-x-auto text-gray-300 whitespace-pre-wrap">
              {CHROME_PROMPT}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
