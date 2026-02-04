/**
 * Breakout game page
 * Classic brick-breaking arcade game with pixel art and 8-bit sounds
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import NavTabs from '@/components/nav_tabs';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  hits: number; // 0 = destroyed
  points: number;
}

// 8-bit sound generator using Web Audio API
class SoundFX {
  private ctx: AudioContext | null = null;

  private get_ctx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.ctx;
  }

  paddle_hit() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  brick_hit(pitch: number = 1) {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    const baseFreq = 400 * pitch;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  wall_hit() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  lose_ball() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  level_complete() {
    const ctx = this.get_ctx();
    const notes = [523, 659, 784, 1047, 1319]; // C5, E5, G5, C6, E6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.12);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.12);
    });
  }

  powerup() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }
}

export default function BreakoutPage() {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const [, set_score] = useState(0);
  const [high_score, set_high_score] = useState(0);
  const [, set_lives] = useState(3);
  const [, set_level] = useState(1);
  const [, set_game_state] = useState<'playing' | 'paused' | 'game_over' | 'level_complete'>('paused');
  const [message, set_message] = useState<{ title: string; text: string } | null>({ title: 'Breakout', text: 'Click or tap to start' });

  const WIDTH = 400;
  const HEIGHT = 500;
  const PADDLE_WIDTH = 80;
  const PADDLE_HEIGHT = 12;
  const BALL_RADIUS = 8;
  const BRICK_ROWS = 6;
  const BRICK_COLS = 8;
  const BRICK_WIDTH = 45;
  const BRICK_HEIGHT = 18;
  const BRICK_PADDING = 4;
  const BRICK_TOP = 60;

  // Game state refs
  const paddle_ref = useRef({ x: WIDTH / 2 - PADDLE_WIDTH / 2, w: PADDLE_WIDTH });
  const ball_ref = useRef({ x: WIDTH / 2, y: HEIGHT - 50, dx: 4, dy: -4, speed: 5 });
  const bricks_ref = useRef<Brick[]>([]);
  const score_ref = useRef(0);
  const lives_ref = useRef(3);
  const level_ref = useRef(1);
  const game_state_ref = useRef<'playing' | 'paused' | 'game_over' | 'level_complete'>('paused');
  const sound_ref = useRef<SoundFX | null>(null);

  // Client-side state
  const [mounted, set_mounted] = useState(false);
  useEffect(() => {
    set_mounted(true);
    sound_ref.current = new SoundFX();
  }, []);

  const is_localhost = mounted && typeof window !== 'undefined' && window.location.hostname === 'localhost';

  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('breakout_high');
      if (saved) set_high_score(parseInt(saved));
    }
  }, [mounted]);

  const create_bricks = (lvl: number) => {
    const bricks: Brick[] = [];
    const colors = [
      { color: '#ff6b6b', points: 50, hits: 1 },  // Red - top
      { color: '#ffa500', points: 40, hits: 1 },  // Orange
      { color: '#ffd93d', points: 30, hits: 1 },  // Yellow
      { color: '#6bcb77', points: 20, hits: 1 },  // Green
      { color: '#4d96ff', points: 15, hits: 1 },  // Blue
      { color: '#9b59b6', points: 10, hits: 1 },  // Purple - bottom
    ];

    // Add some harder bricks at higher levels
    const startX = (WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        const colorInfo = colors[row % colors.length];
        // Higher levels get more multi-hit bricks
        const hits = (lvl > 1 && row < 2 && Math.random() < 0.3 * lvl) ? 2 : colorInfo.hits;
        bricks.push({
          x: startX + col * (BRICK_WIDTH + BRICK_PADDING),
          y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_PADDING),
          w: BRICK_WIDTH,
          h: BRICK_HEIGHT,
          color: hits > 1 ? '#888' : colorInfo.color,
          hits,
          points: colorInfo.points * (hits > 1 ? 2 : 1),
        });
      }
    }
    return bricks;
  };

  const reset_ball = () => {
    const paddle = paddle_ref.current;
    ball_ref.current = {
      x: paddle.x + paddle.w / 2,
      y: HEIGHT - 50,
      dx: (Math.random() > 0.5 ? 1 : -1) * 4,
      dy: -4,
      speed: 5 + level_ref.current * 0.5,
    };
  };

  const start_game = () => {
    if (game_state_ref.current === 'game_over') {
      // Full reset
      score_ref.current = 0;
      set_score(0);
      lives_ref.current = 3;
      set_lives(3);
      level_ref.current = 1;
      set_level(1);
      paddle_ref.current = { x: WIDTH / 2 - PADDLE_WIDTH / 2, w: PADDLE_WIDTH };
      bricks_ref.current = create_bricks(1);
    } else if (game_state_ref.current === 'level_complete') {
      // Next level
      level_ref.current++;
      set_level(level_ref.current);
      bricks_ref.current = create_bricks(level_ref.current);
    }
    reset_ball();
    game_state_ref.current = 'playing';
    set_game_state('playing');
    set_message(null);
  };

  // Initialize bricks
  useEffect(() => {
    if (mounted && bricks_ref.current.length === 0) {
      bricks_ref.current = create_bricks(1);
    }
  }, [mounted]);

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas || !mounted) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Keyboard state for smooth movement
    const keys_pressed = { left: false, right: false };
    const PADDLE_SPEED = 8;

    const handle_key_down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys_pressed.left = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys_pressed.right = true;
        e.preventDefault();
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (game_state_ref.current !== 'playing') {
          start_game();
        }
        e.preventDefault();
      }
    };

    const handle_key_up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keys_pressed.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keys_pressed.right = false;
      }
    };

    const update_paddle_from_keys = () => {
      if (keys_pressed.left) {
        paddle_ref.current.x = Math.max(0, paddle_ref.current.x - PADDLE_SPEED);
      }
      if (keys_pressed.right) {
        paddle_ref.current.x = Math.min(WIDTH - paddle_ref.current.w, paddle_ref.current.x + PADDLE_SPEED);
      }
    };

    // Mouse/touch input
    const handle_mouse_move = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (WIDTH / rect.width);
      paddle_ref.current.x = Math.max(0, Math.min(WIDTH - paddle_ref.current.w, x - paddle_ref.current.w / 2));
    };

    const handle_touch_move = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.touches[0].clientX - rect.left) * (WIDTH / rect.width);
      paddle_ref.current.x = Math.max(0, Math.min(WIDTH - paddle_ref.current.w, x - paddle_ref.current.w / 2));
    };

    const handle_click = () => {
      if (game_state_ref.current !== 'playing') {
        start_game();
      }
    };

    document.addEventListener('keydown', handle_key_down);
    document.addEventListener('keyup', handle_key_up);
    canvas.addEventListener('mousemove', handle_mouse_move);
    canvas.addEventListener('touchmove', handle_touch_move, { passive: false });
    canvas.addEventListener('click', handle_click);
    canvas.addEventListener('touchstart', handle_click, { passive: true });

    let animation_id: number;

    // ========== DRAWING ==========

    const draw_pixel_rect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    };

    const draw_paddle = (x: number, w: number) => {
      const y = HEIGHT - 30;
      const h = PADDLE_HEIGHT;

      // Main body
      draw_pixel_rect(x, y, w, h, '#00d9ff');

      // Highlight
      draw_pixel_rect(x + 2, y + 2, w - 4, 3, '#66e5ff');

      // Edge caps
      draw_pixel_rect(x, y + 2, 4, h - 4, '#0099cc');
      draw_pixel_rect(x + w - 4, y + 2, 4, h - 4, '#0099cc');

      // Shadow
      draw_pixel_rect(x + 2, y + h - 2, w - 4, 2, '#0077aa');
    };

    const draw_ball = (x: number, y: number) => {
      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, BALL_RADIUS + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();

      // Main ball
      ctx.beginPath();
      ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Highlight
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
    };

    const draw_brick = (brick: Brick) => {
      if (brick.hits <= 0) return;

      const { x, y, w, h, color } = brick;

      // Main brick body
      draw_pixel_rect(x, y, w, h, color);

      // Top highlight
      draw_pixel_rect(x + 2, y + 2, w - 4, 3, lighten_color(color, 30));

      // Bottom shadow
      draw_pixel_rect(x + 2, y + h - 3, w - 4, 2, darken_color(color, 30));

      // Left/right edges
      draw_pixel_rect(x, y + 2, 2, h - 4, darken_color(color, 15));
      draw_pixel_rect(x + w - 2, y + 2, 2, h - 4, darken_color(color, 15));

      // Multi-hit indicator (crack pattern)
      if (brick.hits > 1) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 5, y + 4);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.lineTo(x + w / 2 + 5, y + h - 4);
        ctx.stroke();
      }
    };

    const lighten_color = (hex: string, percent: number) => {
      const num = parseInt(hex.slice(1), 16);
      const r = Math.min(255, (num >> 16) + percent);
      const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
      const b = Math.min(255, (num & 0x0000FF) + percent);
      return `rgb(${r},${g},${b})`;
    };

    const darken_color = (hex: string, percent: number) => {
      const num = parseInt(hex.slice(1), 16);
      const r = Math.max(0, (num >> 16) - percent);
      const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
      const b = Math.max(0, (num & 0x0000FF) - percent);
      return `rgb(${r},${g},${b})`;
    };

    const draw_lives = () => {
      const y = HEIGHT - 15;
      for (let i = 0; i < lives_ref.current; i++) {
        ctx.beginPath();
        ctx.arc(20 + i * 20, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
      }
    };

    const draw_score = () => {
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${score_ref.current}`, WIDTH - 10, 25);
      ctx.fillStyle = '#888';
      ctx.fillText(`High: ${high_score}`, WIDTH - 10, 45);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#00d9ff';
      ctx.fillText(`Level ${level_ref.current}`, 10, 25);
    };

    // ========== GAME LOOP ==========

    const update = () => {
      // Update paddle from keyboard input (runs even when paused for responsiveness)
      update_paddle_from_keys();

      if (game_state_ref.current !== 'playing') return;

      const ball = ball_ref.current;
      const paddle = paddle_ref.current;
      const bricks = bricks_ref.current;

      // Move ball
      ball.x += ball.dx;
      ball.y += ball.dy;

      // Wall collisions
      if (ball.x - BALL_RADIUS <= 0) {
        ball.x = BALL_RADIUS;
        ball.dx = Math.abs(ball.dx);
        sound_ref.current?.wall_hit();
      }
      if (ball.x + BALL_RADIUS >= WIDTH) {
        ball.x = WIDTH - BALL_RADIUS;
        ball.dx = -Math.abs(ball.dx);
        sound_ref.current?.wall_hit();
      }
      if (ball.y - BALL_RADIUS <= 0) {
        ball.y = BALL_RADIUS;
        ball.dy = Math.abs(ball.dy);
        sound_ref.current?.wall_hit();
      }

      // Bottom - lose life
      if (ball.y + BALL_RADIUS >= HEIGHT) {
        lives_ref.current--;
        set_lives(lives_ref.current);
        sound_ref.current?.lose_ball();

        if (lives_ref.current <= 0) {
          game_state_ref.current = 'game_over';
          set_game_state('game_over');
          set_message({ title: 'Game Over', text: `Final Score: ${score_ref.current}` });
          if (score_ref.current > high_score) {
            set_high_score(score_ref.current);
            localStorage.setItem('breakout_high', score_ref.current.toString());
          }
        } else {
          reset_ball();
          game_state_ref.current = 'paused';
          set_game_state('paused');
          set_message({ title: `${lives_ref.current} Lives Left`, text: 'Click to continue' });
        }
        return;
      }

      // Paddle collision
      const paddle_y = HEIGHT - 30;
      if (
        ball.y + BALL_RADIUS >= paddle_y &&
        ball.y - BALL_RADIUS <= paddle_y + PADDLE_HEIGHT &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.w
      ) {
        // Calculate bounce angle based on where ball hit paddle
        const hit_pos = (ball.x - paddle.x) / paddle.w; // 0 to 1
        const angle = (hit_pos - 0.5) * Math.PI * 0.7; // -70 to +70 degrees
        const speed = ball.speed;
        ball.dx = Math.sin(angle) * speed;
        ball.dy = -Math.cos(angle) * speed;
        ball.y = paddle_y - BALL_RADIUS;
        sound_ref.current?.paddle_hit();
      }

      // Brick collisions
      for (const brick of bricks) {
        if (brick.hits <= 0) continue;

        if (
          ball.x + BALL_RADIUS > brick.x &&
          ball.x - BALL_RADIUS < brick.x + brick.w &&
          ball.y + BALL_RADIUS > brick.y &&
          ball.y - BALL_RADIUS < brick.y + brick.h
        ) {
          brick.hits--;

          if (brick.hits <= 0) {
            score_ref.current += brick.points;
            set_score(score_ref.current);
            sound_ref.current?.brick_hit(1 + (brick.y - BRICK_TOP) / 100);
          } else {
            // Damaged but not destroyed
            brick.color = '#666';
            sound_ref.current?.brick_hit(0.7);
          }

          // Determine bounce direction
          const overlapLeft = ball.x + BALL_RADIUS - brick.x;
          const overlapRight = brick.x + brick.w - (ball.x - BALL_RADIUS);
          const overlapTop = ball.y + BALL_RADIUS - brick.y;
          const overlapBottom = brick.y + brick.h - (ball.y - BALL_RADIUS);

          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            ball.dx = -ball.dx;
          } else {
            ball.dy = -ball.dy;
          }

          break; // Only hit one brick per frame
        }
      }

      // Check level complete
      if (bricks.every(b => b.hits <= 0)) {
        game_state_ref.current = 'level_complete';
        set_game_state('level_complete');
        set_message({ title: 'Level Complete!', text: 'Click for next level' });
        sound_ref.current?.level_complete();
      }
    };

    const draw = () => {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Draw bricks
      for (const brick of bricks_ref.current) {
        draw_brick(brick);
      }

      // Draw paddle
      draw_paddle(paddle_ref.current.x, paddle_ref.current.w);

      // Draw ball (only if playing or paused with lives)
      if (game_state_ref.current === 'playing' || (game_state_ref.current === 'paused' && lives_ref.current > 0)) {
        draw_ball(ball_ref.current.x, ball_ref.current.y);
      }

      // Draw UI
      draw_score();
      draw_lives();
    };

    const game_loop = () => {
      update();
      draw();
      animation_id = requestAnimationFrame(game_loop);
    };

    game_loop();

    return () => {
      document.removeEventListener('keydown', handle_key_down);
      document.removeEventListener('keyup', handle_key_up);
      canvas.removeEventListener('mousemove', handle_mouse_move);
      canvas.removeEventListener('touchmove', handle_touch_move);
      canvas.removeEventListener('click', handle_click);
      canvas.removeEventListener('touchstart', handle_click);
      cancelAnimationFrame(animation_id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, high_score]);

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
          margin-bottom: 15px;
        }
        .game-container {
          position: relative;
        }
        canvas {
          border: 2px solid #00d9ff;
          border-radius: 8px;
          max-width: 100%;
          touch-action: none;
          cursor: none;
        }
        .message {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          padding: 25px 45px;
          border-radius: 10px;
          text-align: center;
          z-index: 10;
        }
        .message h2 {
          color: #00d9ff;
          margin-bottom: 10px;
          font-size: 1.5em;
        }
        .message p {
          color: #aaa;
        }
        .hint {
          margin-top: 15px;
          color: #666;
          font-size: 0.85em;
        }
      `}</style>

      <div className="nav-wrapper">
        <NavTabs is_localhost={is_localhost} />
      </div>
      <div className="game-content">
        <h1>Breakout</h1>

        <div className="game-container">
          <canvas ref={canvas_ref} width={WIDTH} height={HEIGHT} />
          {message && (
            <div className="message">
              <h2>{message.title}</h2>
              <p>{message.text}</p>
            </div>
          )}
        </div>

        <p className="hint">Arrow keys, A/D, mouse, or touch to move • Space to start</p>
      </div>
    </div>
  );
}
