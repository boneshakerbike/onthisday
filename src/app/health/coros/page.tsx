'use client'

import { useEffect, useState } from 'react'
import NavTabs from '@/components/nav_tabs'

const CHROME_PROMPT = `Generate a comprehensive morning training report from the COROS Training Hub by collecting data from all key sections:

1. Start at the Dashboard tab (https://t.coros.com/admin/views/dash-board)
2. Capture all Dashboard metrics including:
   - Weekly Activity chart data
   - Recent Activities list
   - Overnight HRV status and ranges
   - Training Status (Maintaining/Optimized/etc.)
   - 7-Day Efficiency Scores
   - Threshold Heart Rate Zones
   - Recovery status and percentage
   - Personal Cycling Records
   - Race Predictor data

3. Navigate to EvoLab Metrics tab and capture:
   - Training Status (12 weeks) graph
   - Training Summary (4 weeks): Total Distance, Total Time, Total Load, Times, Average HR
   - Activity Data (12 weeks): Training Load chart
   - Running Fitness & Efficiency (12 weeks)
   - 4-Week Intensity Distribution (Hard/Med/Easy breakdown by training load)
   - VO2 Max (12 weeks) with Max and Avg values
   - Distance Zone Distribution (4 weeks) with frequency percentages
   - Threshold Heart Rate Zones Distribution (4 weeks) with load breakdown
   - Overnight HRV (4 weeks) with average value
   - Weekly Training Load (12 weeks) chart data
   - Resting Heart Rate (12 weeks) with Low and Avg values

4. Navigate to Activity List tab and identify yesterday's date
5. For EACH activity from yesterday (sort by date descending):
   - Click on the activity name to open detailed view
   - Capture summary metrics: Distance/Sets, Activity Time, Total Time, Avg Speed/Pace, Avg HR, Elevation Gain, Total Descent, Calories, Training Load
   - Expand "Time in Zones" section and capture HR Zone breakdown (zone ranges, times, percentages)
   - For running activities: Expand Pace Zone breakdown instead
   - For strength/flexibility activities: Capture exercise list with load/rest/time/calories per exercise, sets count, total reps
   - Capture Efficiency, Aerobic TE, Anaerobic TE values
   - Note the activity timestamp (date and time)
   - Go back to Activity List and repeat for next activity

6. Compile all collected data into a structured markdown report with sections for:
   - Overnight HRV & Recovery Status
   - Training Status & Fitness metrics
   - Yesterday's Activities (each activity with full details, HR/pace zone tables, key observations)
   - Daily/Weekly Training Load summaries
   - EvoLab 4-Week metrics with zone distribution tables
   - Personal Records section
   - Race Predictor table
   - Key Takeaways based on recovery status, training load, and overall patterns

7. POST the compiled report as JSON to:

   POST https://8i11.vercel.app/api/coros/save
   Headers:
     Content-Type: application/json
     X-Guest-Pin: [YOUR_PIN]

   Body:
   {
     "date": "YYYY-MM-DD",
     "data": {
       "report_markdown": "<the full markdown report>",
       "dashboard": { ... captured dashboard metrics ... },
       "evolab": { ... captured EvoLab metrics ... },
       "activities": [ ... yesterday's activity details ... ]
     }
   }

   Use yesterday's date for the "date" field (the date the activities are from).

8. Once the POST succeeds, close all browser tabs and windows that were opened or used for this automation and terminate the session.

Format the report as a professional morning briefing suitable for a cyclist/runner with training data visualization through tables and emojis for quick scanning. Include specific values, not ranges. Calculate daily totals and weekly totals where applicable.`

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
