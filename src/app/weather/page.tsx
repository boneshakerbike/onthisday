/**
 * TV Weather Display — Missoula, MT
 * Large-text, dark-background weather display optimized for TV viewing.
 * Data from Open-Meteo (no API key required). Auto-refreshes every 10 minutes.
 */

'use client';

import { useEffect, useState, useRef } from 'react';

// Open-Meteo API — Missoula, MT coordinates
const API_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=46.8721&longitude=-114.0016' +
  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m' +
  '&hourly=temperature_2m,precipitation_probability,weather_code' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset' +
  '&timezone=America/Denver' +
  '&forecast_days=7' +
  '&temperature_unit=fahrenheit' +
  '&wind_speed_unit=mph' +
  '&precipitation_unit=inch';

// WMO weather code → emoji + description
function wmo_to_emoji(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌧️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code === 85 || code === 86) return '🌨️';
  if (code >= 95 && code <= 99) return '⛈️';
  return '🌡️';
}

function wmo_to_desc(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45) return 'Fog';
  if (code === 48) return 'Icy fog';
  if (code === 51) return 'Light drizzle';
  if (code === 53) return 'Drizzle';
  if (code === 55) return 'Heavy drizzle';
  if (code === 56 || code === 57) return 'Freezing drizzle';
  if (code === 61) return 'Light rain';
  if (code === 63) return 'Rain';
  if (code === 65) return 'Heavy rain';
  if (code === 66 || code === 67) return 'Freezing rain';
  if (code === 71) return 'Light snow';
  if (code === 73) return 'Snow';
  if (code === 75) return 'Heavy snow';
  if (code === 77) return 'Snow grains';
  if (code === 80) return 'Light showers';
  if (code === 81) return 'Showers';
  if (code === 82) return 'Heavy showers';
  if (code === 85) return 'Snow showers';
  if (code === 86) return 'Heavy snow showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm w/ hail';
  return 'Unknown';
}

// Wind degrees → compass direction
function wind_direction(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// Format hour from ISO string: "2:00 PM"
function format_hour(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

// Format day name from ISO date string: "Mon", "Tue", etc.
function format_day(iso_date: string): string {
  const [year, month, day] = iso_date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// "Today" label for first daily entry
function format_day_label(iso_date: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return format_day(iso_date);
}

interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
  };
}

export default function WeatherPage() {
  const [data, set_data] = useState<WeatherData | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [updated_at, set_updated_at] = useState<string | null>(null);
  const interval_ref = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetch_weather() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error(`Open-Meteo API returned HTTP ${res.status}`);
      const json = await res.json();
      set_data(json as WeatherData);
      set_error(null);
      const now = new Date();
      set_updated_at(
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    } catch (e) {
      set_error(e instanceof Error ? e.message : 'Open-Meteo API is unreachable');
    }
  }

  useEffect(() => {
    document.title = '8i11 | Weather';
    fetch_weather();

    // Refresh every 10 minutes
    interval_ref.current = setInterval(fetch_weather, 10 * 60 * 1000);
    return () => {
      if (interval_ref.current) clearInterval(interval_ref.current);
    };
  }, []);

  // Find the next 12 hourly slots starting from the current hour
  function get_hourly_slots(): { time: string; temp: number; precip_pct: number; code: number }[] {
    if (!data) return [];
    const now = new Date();

    // Find the next hourly index at or after the current time
    let start_idx = data.hourly.time.findIndex((t) => {
      const d = new Date(t);
      return d >= now;
    });
    if (start_idx === -1) start_idx = 0;

    return data.hourly.time.slice(start_idx, start_idx + 12).map((t, i) => ({
      time: t,
      temp: Math.round(data.hourly.temperature_2m[start_idx + i]),
      precip_pct: data.hourly.precipitation_probability[start_idx + i] ?? 0,
      code: data.hourly.weather_code[start_idx + i],
    }));
  }

  const styles: Record<string, React.CSSProperties> = {
    page: {
      backgroundColor: '#111',
      color: '#f0f0f0',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      padding: 'clamp(1rem, 4vw, 1.5rem) clamp(1rem, 5vw, 2rem)',
      boxSizing: 'border-box',
      overflowX: 'hidden' as const,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
      borderBottom: '1px solid #333',
      paddingBottom: '0.75rem',
    },
    location: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#fff',
      letterSpacing: '-0.02em',
    },
    updated: {
      fontSize: '1rem',
      color: '#888',
    },
    current_section: {
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(1rem, 4vw, 2.5rem)',
      marginBottom: '2rem',
      flexWrap: 'wrap',
    },
    temp_block: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    current_temp: {
      fontSize: 'clamp(3.5rem, 16vw, 9rem)',
      fontWeight: '800',
      lineHeight: '1',
      color: '#fff',
      letterSpacing: '-0.04em',
    },
    feels_like: {
      fontSize: '1.6rem',
      color: '#aaa',
      marginTop: '0.25rem',
    },
    condition_block: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    condition_emoji: {
      fontSize: 'clamp(2.5rem, 9vw, 5rem)',
      lineHeight: '1',
    },
    condition_text: {
      fontSize: 'clamp(1.1rem, 4vw, 1.75rem)',
      fontWeight: '600',
      color: '#e0e0e0',
    },
    details_block: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      marginLeft: 'auto',
    },
    detail_row: {
      fontSize: '1.4rem',
      color: '#ccc',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    detail_label: {
      color: '#888',
      fontSize: '1.1rem',
      minWidth: '5rem',
    },
    section_title: {
      fontSize: '1rem',
      fontWeight: '600',
      color: '#666',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.1em',
      marginBottom: '0.75rem',
    },
    hourly_row: {
      display: 'flex',
      gap: '0.5rem',
      overflowX: 'auto' as const,
      marginBottom: '2rem',
      paddingBottom: '0.5rem',
    },
    hourly_card: {
      flex: '0 0 auto',
      backgroundColor: '#1e1e1e',
      borderRadius: '0.75rem',
      padding: '0.75rem 1rem',
      textAlign: 'center' as const,
      minWidth: '6rem',
      border: '1px solid #2a2a2a',
    },
    hourly_time: {
      fontSize: '1rem',
      color: '#888',
      marginBottom: '0.35rem',
    },
    hourly_emoji: {
      fontSize: '1.75rem',
      margin: '0.25rem 0',
    },
    hourly_temp: {
      fontSize: '1.4rem',
      fontWeight: '700',
      color: '#f0f0f0',
    },
    hourly_precip: {
      fontSize: '0.9rem',
      color: '#6ab0f5',
      marginTop: '0.2rem',
    },
    daily_row: {
      display: 'flex',
      gap: '0.75rem',
      overflowX: 'auto' as const,
      paddingBottom: '0.5rem',
    },
    daily_card: {
      flex: '1 1 5.5rem',
      minWidth: '5.5rem',
      backgroundColor: '#1e1e1e',
      borderRadius: '0.75rem',
      padding: '1rem 0.75rem',
      textAlign: 'center' as const,
      border: '1px solid #2a2a2a',
    },
    daily_day: {
      fontSize: '1.1rem',
      fontWeight: '700',
      color: '#ccc',
      marginBottom: '0.4rem',
    },
    daily_emoji: {
      fontSize: '2rem',
      margin: '0.35rem 0',
    },
    daily_high: {
      fontSize: '1.5rem',
      fontWeight: '700',
      color: '#f97316',
    },
    daily_low: {
      fontSize: '1.25rem',
      color: '#60a5fa',
    },
    daily_precip: {
      fontSize: '0.95rem',
      color: '#6ab0f5',
      marginTop: '0.3rem',
    },
    error_state: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '1',
      color: '#888',
      fontSize: '1.5rem',
      gap: '1rem',
    },
    loading_state: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '1',
      color: '#666',
      fontSize: '1.5rem',
    },
  };

  const hourly_slots = get_hourly_slots();

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <span style={styles.location}>Missoula, MT</span>
        {updated_at && (
          <span style={styles.updated}>Updated: {updated_at}</span>
        )}
      </header>

      {/* Body */}
      {error && !data && (
        <div style={styles.error_state}>
          <span>⚠️</span>
          <span>Weather data unavailable</span>
          <span style={{ fontSize: '1rem', color: '#555' }}>
            This is not an app error — the external weather service is down.
          </span>
          <span style={{ fontSize: '0.95rem', color: '#666' }}>{error}</span>
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.95rem', color: '#6ab0f5', textDecoration: 'underline' }}
          >
            Check Open-Meteo status
          </a>
        </div>
      )}

      {!data && !error && (
        <div style={styles.loading_state}>
          <span>Loading weather…</span>
        </div>
      )}

      {data && (
        <>
          {/* Current Conditions */}
          <section style={styles.current_section}>
            <div style={styles.temp_block}>
              <span style={styles.current_temp}>
                {Math.round(data.current.temperature_2m)}°
              </span>
              <span style={styles.feels_like}>
                Feels like {Math.round(data.current.apparent_temperature)}°F
              </span>
            </div>

            <div style={styles.condition_block}>
              <span style={styles.condition_emoji}>
                {wmo_to_emoji(data.current.weather_code)}
              </span>
              <span style={styles.condition_text}>
                {wmo_to_desc(data.current.weather_code)}
              </span>
            </div>

            <div style={styles.details_block}>
              <div style={styles.detail_row}>
                <span style={styles.detail_label}>Wind</span>
                <span>
                  {Math.round(data.current.wind_speed_10m)} mph{' '}
                  {wind_direction(data.current.wind_direction_10m)}
                </span>
              </div>
              <div style={styles.detail_row}>
                <span style={styles.detail_label}>Humidity</span>
                <span>{data.current.relative_humidity_2m}%</span>
              </div>
              {data.daily.sunrise[0] && (
                <div style={styles.detail_row}>
                  <span style={styles.detail_label}>Sunrise</span>
                  <span>
                    {new Date(data.daily.sunrise[0]).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
              )}
              {data.daily.sunset[0] && (
                <div style={styles.detail_row}>
                  <span style={styles.detail_label}>Sunset</span>
                  <span>
                    {new Date(data.daily.sunset[0]).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Hourly Strip */}
          {hourly_slots.length > 0 && (
            <section>
              <div style={styles.section_title}>Next 12 Hours</div>
              <div style={styles.hourly_row}>
                {hourly_slots.map((slot) => (
                  <div key={slot.time} style={styles.hourly_card}>
                    <div style={styles.hourly_time}>{format_hour(slot.time)}</div>
                    <div style={styles.hourly_emoji}>{wmo_to_emoji(slot.code)}</div>
                    <div style={styles.hourly_temp}>{slot.temp}°</div>
                    {slot.precip_pct > 0 && (
                      <div style={styles.hourly_precip}>{slot.precip_pct}%</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 7-Day Forecast */}
          <section>
            <div style={styles.section_title}>7-Day Forecast</div>
            <div style={styles.daily_row}>
              {data.daily.time.map((date, i) => (
                <div key={date} style={styles.daily_card}>
                  <div style={styles.daily_day}>{format_day_label(date, i)}</div>
                  <div style={styles.daily_emoji}>{wmo_to_emoji(data.daily.weather_code[i])}</div>
                  <div style={styles.daily_high}>
                    {Math.round(data.daily.temperature_2m_max[i])}°
                  </div>
                  <div style={styles.daily_low}>
                    {Math.round(data.daily.temperature_2m_min[i])}°
                  </div>
                  {data.daily.precipitation_sum[i] > 0 && (
                    <div style={styles.daily_precip}>
                      {data.daily.precipitation_sum[i].toFixed(2)}&quot;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
