/**
 * Frogger game page
 * Classic arcade game with mobile-friendly controls
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import NavTabs from '@/components/nav_tabs';

interface Lane {
  type: 'safe' | 'goal' | 'road' | 'water';
  y: number;
  dir?: number;
  speed?: number;
  objects?: { x: number; w: number }[];
}

export default function FroggerPage() {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const [score, set_score] = useState(0);
  const [high_score, set_high_score] = useState(0);
  const [game_over, set_game_over] = useState(false);
  const [message, set_message] = useState<{ title: string; text: string } | null>(null);
  const [is_localhost, set_is_localhost] = useState(false);

  const GRID = 40;
  const COLS = 10;
  const ROWS = 12;

  // Game state refs (to avoid stale closures)
  const frog_ref = useRef({ x: 4, y: 11 });
  const score_ref = useRef(0);
  const game_over_ref = useRef(false);

  const lanes_ref = useRef<Lane[]>([
    { type: 'safe', y: 11 },
    { type: 'goal', y: 0 },
    { type: 'road', y: 10, dir: 1, speed: 2, objects: [{ x: 0, w: 2 }, { x: 5, w: 2 }] },
    { type: 'road', y: 9, dir: -1, speed: 3, objects: [{ x: 2, w: 3 }, { x: 7, w: 2 }] },
    { type: 'road', y: 8, dir: 1, speed: 1.5, objects: [{ x: 1, w: 2 }, { x: 4, w: 2 }, { x: 8, w: 2 }] },
    { type: 'safe', y: 7 },
    { type: 'water', y: 6, dir: -1, speed: 1, objects: [{ x: 0, w: 3 }, { x: 5, w: 4 }] },
    { type: 'water', y: 5, dir: 1, speed: 2, objects: [{ x: 1, w: 2 }, { x: 5, w: 2 }, { x: 8, w: 2 }] },
    { type: 'water', y: 4, dir: -1, speed: 1.5, objects: [{ x: 0, w: 4 }, { x: 6, w: 3 }] },
    { type: 'water', y: 3, dir: 1, speed: 2.5, objects: [{ x: 2, w: 2 }, { x: 6, w: 3 }] },
    { type: 'water', y: 2, dir: -1, speed: 1, objects: [{ x: 0, w: 3 }, { x: 5, w: 2 }, { x: 8, w: 2 }] },
    { type: 'goal', y: 1 },
  ]);

  useEffect(() => {
    set_is_localhost(window.location.hostname === 'localhost');
    const saved = localStorage.getItem('frogger_high');
    if (saved) {
      set_high_score(parseInt(saved));
    }
  }, []);

  const move = (dir: string) => {
    if (game_over_ref.current) return;
    const frog = frog_ref.current;

    if (dir === 'up' && frog.y > 0) frog.y--;
    if (dir === 'down' && frog.y < ROWS - 1) frog.y++;
    if (dir === 'left' && frog.x > 0) frog.x--;
    if (dir === 'right' && frog.x < COLS - 1) frog.x++;

    if (frog.y <= 1) {
      score_ref.current += 100;
      set_score(score_ref.current);
      if (score_ref.current > high_score) {
        set_high_score(score_ref.current);
        localStorage.setItem('frogger_high', score_ref.current.toString());
      }
      frog_ref.current = { x: 4, y: 11 };
      set_message({ title: 'Nice!', text: '+100 points' });
      setTimeout(() => set_message(null), 1000);
    }
  };

  const end_game = (title: string, text: string) => {
    game_over_ref.current = true;
    set_game_over(true);
    set_message({ title, text });
  };

  const reset_game = () => {
    frog_ref.current = { x: 4, y: 11 };
    score_ref.current = 0;
    set_score(0);
    game_over_ref.current = false;
    set_game_over(false);
    set_message(null);
  };

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handle_key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') { move('up'); e.preventDefault(); }
      if (e.key === 'ArrowDown') { move('down'); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { move('left'); e.preventDefault(); }
      if (e.key === 'ArrowRight') { move('right'); e.preventDefault(); }
    };

    let touch_start: { x: number; y: number } | null = null;

    const handle_touch_start = (e: TouchEvent) => {
      e.preventDefault();
      touch_start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handle_touch_move = (e: TouchEvent) => {
      e.preventDefault();
    };

    const handle_touch_end = (e: TouchEvent) => {
      if (!touch_start || game_over_ref.current) return;
      const dx = e.changedTouches[0].clientX - touch_start.x;
      const dy = e.changedTouches[0].clientY - touch_start.y;
      const min_swipe = 30;
      if (Math.abs(dx) > min_swipe || Math.abs(dy) > min_swipe) {
        if (Math.abs(dx) > Math.abs(dy)) {
          move(dx > 0 ? 'right' : 'left');
        } else {
          move(dy > 0 ? 'down' : 'up');
        }
      }
      touch_start = null;
    };

    document.addEventListener('keydown', handle_key);
    canvas.addEventListener('touchstart', handle_touch_start, { passive: false });
    canvas.addEventListener('touchmove', handle_touch_move, { passive: false });
    canvas.addEventListener('touchend', handle_touch_end);

    let animation_id: number;

    const update = () => {
      const lanes = lanes_ref.current;
      const frog = frog_ref.current;

      for (const lane of lanes) {
        if (lane.objects && lane.dir && lane.speed) {
          for (const obj of lane.objects) {
            obj.x += lane.dir * lane.speed * 0.016;
            if (lane.dir > 0 && obj.x > COLS) obj.x = -obj.w;
            if (lane.dir < 0 && obj.x + obj.w < 0) obj.x = COLS;
          }
        }
      }

      if (!game_over_ref.current) {
        const lane = lanes.find(l => l.y === frog.y);
        if (lane) {
          if (lane.type === 'road' && lane.objects) {
            for (const obj of lane.objects) {
              if (frog.x + 1 > obj.x && frog.x < obj.x + obj.w) {
                end_game('Game Over', 'You were hit by a car!');
                return;
              }
            }
          } else if (lane.type === 'water' && lane.objects && lane.dir && lane.speed) {
            let on_log = false;
            for (const obj of lane.objects) {
              if (frog.x + 1 > obj.x && frog.x < obj.x + obj.w) {
                on_log = true;
                frog.x += lane.dir * lane.speed * 0.016;
                break;
              }
            }
            if (!on_log || frog.x < -1 || frog.x > COLS) {
              end_game('Splash!', 'You fell in the water!');
            }
          }
        }
      }
    };

    const draw = () => {
      const lanes = lanes_ref.current;
      const frog = frog_ref.current;

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const lane of lanes) {
        const y = lane.y * GRID;

        if (lane.type === 'safe') {
          ctx.fillStyle = '#2d5a27';
          ctx.fillRect(0, y, canvas.width, GRID);
        } else if (lane.type === 'goal') {
          ctx.fillStyle = '#1b4332';
          ctx.fillRect(0, y, canvas.width, GRID);
          ctx.fillStyle = '#40916c';
          for (let i = 1; i < COLS; i += 2) {
            ctx.fillRect(i * GRID + 5, y + 5, GRID - 10, GRID - 10);
          }
        } else if (lane.type === 'road' && lane.objects) {
          ctx.fillStyle = '#333';
          ctx.fillRect(0, y, canvas.width, GRID);
          ctx.strokeStyle = '#555';
          ctx.setLineDash([10, 10]);
          ctx.beginPath();
          ctx.moveTo(0, y + GRID / 2);
          ctx.lineTo(canvas.width, y + GRID / 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = lane.dir && lane.dir > 0 ? '#e63946' : '#f4a261';
          for (const obj of lane.objects) {
            ctx.fillRect(obj.x * GRID, y + 5, obj.w * GRID - 4, GRID - 10);
          }
        } else if (lane.type === 'water' && lane.objects) {
          ctx.fillStyle = '#1d3557';
          ctx.fillRect(0, y, canvas.width, GRID);
          ctx.fillStyle = '#8b4513';
          for (const obj of lane.objects) {
            ctx.fillRect(obj.x * GRID, y + 8, obj.w * GRID - 4, GRID - 16);
          }
        }
      }

      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(frog.x * GRID + GRID / 2, frog.y * GRID + GRID / 2, GRID / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(frog.x * GRID + GRID / 3, frog.y * GRID + GRID / 3, 4, 0, Math.PI * 2);
      ctx.arc(frog.x * GRID + (GRID * 2) / 3, frog.y * GRID + GRID / 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(frog.x * GRID + GRID / 3, frog.y * GRID + GRID / 3, 2, 0, Math.PI * 2);
      ctx.arc(frog.x * GRID + (GRID * 2) / 3, frog.y * GRID + GRID / 3, 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const game_loop = () => {
      update();
      draw();
      animation_id = requestAnimationFrame(game_loop);
    };

    game_loop();

    return () => {
      document.removeEventListener('keydown', handle_key);
      canvas.removeEventListener('touchstart', handle_touch_start);
      canvas.removeEventListener('touchmove', handle_touch_move);
      canvas.removeEventListener('touchend', handle_touch_end);
      cancelAnimationFrame(animation_id);
    };
  }, [high_score]);

  // Track if touch was used to prevent double-firing
  const touch_used_ref = useRef(false);

  const handle_touch = (dir: string) => (e: React.TouchEvent) => {
    e.preventDefault();
    touch_used_ref.current = true;
    move(dir);
    // Reset after a short delay
    setTimeout(() => { touch_used_ref.current = false; }, 300);
  };

  const handle_click = (dir: string) => (e: React.MouseEvent) => {
    // Skip if this was triggered by touch
    if (touch_used_ref.current) {
      e.preventDefault();
      return;
    }
    move(dir);
  };

  return (
    <div className="game-page">
      <style jsx>{`
        .game-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: 'Segoe UI', system-ui, sans-serif;
          color: #e4e4e4;
          padding: 20px;
        }
        .nav-wrapper {
          width: 100%;
          max-width: 600px;
          margin-bottom: 10px;
        }
        .game-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          justify-content: center;
        }
        h1 {
          color: #00d9ff;
          font-weight: 300;
          margin-bottom: 10px;
        }
        .score-display {
          margin-bottom: 15px;
          font-size: 1.1em;
          color: #888;
        }
        .score-display span {
          color: #00d9ff;
          font-weight: bold;
        }
        .game-container {
          position: relative;
        }
        canvas {
          border: 2px solid #00d9ff;
          border-radius: 8px;
          max-width: 100%;
          touch-action: none;
        }
        .message {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          padding: 20px 40px;
          border-radius: 10px;
          text-align: center;
          z-index: 10;
        }
        .message h2 {
          color: #00d9ff;
          margin-bottom: 10px;
        }
        .message button {
          margin-top: 15px;
          padding: 10px 30px;
          font-size: 1em;
          background: #00d9ff;
          border: none;
          border-radius: 6px;
          color: #1a1a2e;
          cursor: pointer;
        }
        .controls {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(3, 80px);
          grid-template-rows: 80px 70px;
          gap: 8px;
          user-select: none;
        }
        .controls button {
          width: 80px;
          height: 70px;
          font-size: 32px;
          background: rgba(0, 217, 255, 0.15);
          border: 2px solid rgba(0, 217, 255, 0.4);
          border-radius: 12px;
          color: #fff;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .controls button:active {
          background: rgba(0, 217, 255, 0.4);
          border-color: #00d9ff;
          transform: scale(0.95);
        }
        .controls .up {
          grid-column: 2;
          height: 80px;
          background: rgba(0, 217, 255, 0.25);
        }
        .controls .left { grid-column: 1; grid-row: 2; }
        .controls .down { grid-column: 2; grid-row: 2; }
        .controls .right { grid-column: 3; grid-row: 2; }
        .hint {
          margin-top: 15px;
          color: #666;
          font-size: 0.85em;
        }
        @media (hover: hover) and (pointer: fine) {
          .controls { display: none; }
          .hint-touch { display: none; }
        }
        @media (hover: none), (pointer: coarse) {
          .hint-desktop { display: none; }
        }
      `}</style>

      <div className="nav-wrapper">
        <NavTabs is_localhost={is_localhost} />
      </div>
      <div className="game-content">
      <h1>Frogger</h1>
      <div className="score-display">
        Score: <span>{score}</span> | High: <span>{high_score}</span>
      </div>

      <div className="game-container">
        <canvas ref={canvas_ref} width={400} height={480} />
        {message && (
          <div className="message">
            <h2>{message.title}</h2>
            <p>{message.text}</p>
            {game_over && (
              <button onClick={reset_game}>Play Again</button>
            )}
          </div>
        )}
      </div>

      <div className="controls">
        <button className="up" onTouchStart={handle_touch('up')} onClick={handle_click('up')}>↑</button>
        <button className="left" onTouchStart={handle_touch('left')} onClick={handle_click('left')}>←</button>
        <button className="down" onTouchStart={handle_touch('down')} onClick={handle_click('down')}>↓</button>
        <button className="right" onTouchStart={handle_touch('right')} onClick={handle_click('right')}>→</button>
      </div>

      <p className="hint hint-desktop">Use arrow keys to move</p>
      <p className="hint hint-touch">Tap buttons or swipe to move</p>
      </div>
    </div>
  );
}
