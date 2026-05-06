'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NavTabs from '@/components/nav_tabs';

interface DataPoint {
  date: number;
  dateStr: string;
  value: number;
}

interface MetricData {
  slug: string;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  range: number;
  average: number | null;
  dataPoints: DataPoint[];
}

function TrendChart({ data, average, higherIsBetter }: { data: DataPoint[]; average: number | null; higherIsBetter: boolean }) {
  if (data.length === 0) {
    return <div className="text-gray-500 text-sm py-12 text-center">No data yet for this range.</div>;
  }

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yMin = minVal - range * 0.1;
  const yMax = maxVal + range * 0.1;

  function x(i: number) {
    if (data.length === 1) return padding.left + chartW / 2;
    return padding.left + (i / (data.length - 1)) * chartW;
  }

  function y(val: number) {
    return padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
  }

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');

  // Y-axis labels (3 ticks)
  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map(v => Math.round(v * 10) / 10);

  // X-axis labels (first, middle, last)
  const xLabels: { i: number; label: string }[] = [];
  if (data.length >= 1) xLabels.push({ i: 0, label: data[0].dateStr.slice(5) });
  if (data.length >= 3) xLabels.push({ i: Math.floor(data.length / 2), label: data[Math.floor(data.length / 2)].dateStr.slice(5) });
  if (data.length >= 2) xLabels.push({ i: data.length - 1, label: data[data.length - 1].dateStr.slice(5) });

  // Color the last point based on trend vs previous
  let lastPointColor = '#9ca3af'; // gray
  if (data.length >= 2) {
    const last = data[data.length - 1].value;
    const prev = data[data.length - 2].value;
    if (last > prev) lastPointColor = higherIsBetter ? '#4ade80' : '#f87171';
    else if (last < prev) lastPointColor = higherIsBetter ? '#f87171' : '#4ade80';
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl" preserveAspectRatio="xMidYMid meet">
      {/* Y-axis labels */}
      {yTicks.map((tick, i) => (
        <text key={i} x={padding.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500" fontSize="11">
          {tick}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ i, label }) => (
        <text key={i} x={x(i)} y={height - 5} textAnchor="middle" className="fill-gray-500" fontSize="11">
          {label}
        </text>
      ))}

      {/* Average line */}
      {average != null && (
        <>
          <line x1={padding.left} y1={y(average)} x2={padding.left + chartW} y2={y(average)} stroke="#525252" strokeDasharray="4 4" strokeWidth="1" />
          <text x={padding.left + chartW + 4} y={y(average)} dominantBaseline="middle" className="fill-gray-500" fontSize="10">
            avg
          </text>
        </>
      )}

      {/* Line */}
      <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />

      {/* Data points */}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 5 : 3} fill={i === data.length - 1 ? lastPointColor : '#60a5fa'} />
      ))}
    </svg>
  );
}

export default function MetricDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(7);

  useEffect(() => {
    if (data) {
      document.title = `8i11 | ${data.label} Trend`;
    }
  }, [data]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/coaching/metrics/${slug}?range=${range}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // best effort
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, range]);

  const ranges = [
    { value: 7, label: 'Week' },
    { value: 30, label: 'Month' },
    { value: 90, label: '90 days' },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <NavTabs />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/coach" className="text-gray-400 hover:text-white text-sm">&larr; Coach</Link>
          <h1 className="text-xl font-bold">{data?.label || slug}</h1>
        </div>

        {/* Range selector */}
        <div className="flex gap-2 mb-4">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                range === r.value
                  ? 'bg-zinc-700 border-zinc-600 text-white'
                  : 'bg-transparent border-zinc-800 text-gray-500 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-gray-500 text-sm py-12 text-center">Loading...</div>
        ) : data ? (
          <div className="space-y-4">
            {/* Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <TrendChart data={data.dataPoints} average={data.average} higherIsBetter={data.higherIsBetter} />
            </div>

            {/* Summary stats */}
            {data.dataPoints.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">Latest</div>
                  <div className="text-lg font-semibold text-white">
                    {data.dataPoints[data.dataPoints.length - 1].value}
                    <span className="text-sm text-gray-400 ml-0.5">{data.unit}</span>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">Average</div>
                  <div className="text-lg font-semibold text-white">
                    {data.average}
                    <span className="text-sm text-gray-400 ml-0.5">{data.unit}</span>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">Data points</div>
                  <div className="text-lg font-semibold text-white">{data.dataPoints.length}</div>
                </div>
              </div>
            )}

            {/* Raw values table */}
            {data.dataPoints.length > 0 && (
              <details className="text-sm">
                <summary className="text-gray-500 cursor-pointer text-xs">Raw values</summary>
                <div className="mt-2 space-y-1">
                  {[...data.dataPoints].reverse().map(d => (
                    <div key={d.date} className="flex justify-between text-gray-400 text-xs">
                      <span>{d.dateStr}</span>
                      <span>{d.value} {data.unit}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-12 text-center">Metric not found.</div>
        )}
      </div>
    </main>
  );
}
