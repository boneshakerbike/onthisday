/**
 * Frogger game page
 * Classic arcade game with pixel art sprites and 8-bit sounds
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import NavTabs from '@/components/nav_tabs';

interface LaneObject {
  x: number;
  w: number;
  variant?: number; // For visual variety (car color, log type, etc.)
}

interface Lane {
  type: 'safe' | 'goal' | 'road' | 'water';
  y: number;
  dir?: number;
  speed?: number;
  objects?: LaneObject[];
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

  hop() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  splash() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noise = ctx.createOscillator();
    osc.connect(gain);
    noise.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(100, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    noise.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    noise.stop(ctx.currentTime + 0.3);
  }

  splat() {
    const ctx = this.get_ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  victory() {
    const ctx = this.get_ctx();
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.15);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.15);
    });
  }
}

export default function FroggerPage() {
  const canvas_ref = useRef<HTMLCanvasElement>(null);
  const [score, set_score] = useState(0);
  const [high_score, set_high_score] = useState(0);
  const [game_over, set_game_over] = useState(false);
  const [message, set_message] = useState<{ title: string; text: string } | null>(null);

  const GRID = 40;
  const COLS = 10;
  const ROWS = 12;

  // Game state refs (to avoid stale closures)
  const frog_ref = useRef({ x: 4, y: 11, hop_frame: 0, facing: 'up' as string });
  const score_ref = useRef(0);
  const game_over_ref = useRef(false);
  const sound_ref = useRef<SoundFX | null>(null);

  const lanes_ref = useRef<Lane[]>([
    { type: 'safe', y: 11 },
    { type: 'goal', y: 0 },
    { type: 'road', y: 10, dir: 1, speed: 2, objects: [{ x: 0, w: 2, variant: 0 }, { x: 5, w: 2, variant: 1 }] },
    { type: 'road', y: 9, dir: -1, speed: 3, objects: [{ x: 2, w: 3, variant: 2 }, { x: 7, w: 2, variant: 0 }] },
    { type: 'road', y: 8, dir: 1, speed: 1.5, objects: [{ x: 1, w: 2, variant: 1 }, { x: 4, w: 2, variant: 2 }, { x: 8, w: 2, variant: 0 }] },
    { type: 'safe', y: 7 },
    { type: 'water', y: 6, dir: -1, speed: 1, objects: [{ x: 0, w: 3, variant: 0 }, { x: 5, w: 4, variant: 1 }] },
    { type: 'water', y: 5, dir: 1, speed: 2, objects: [{ x: 1, w: 2, variant: 2 }, { x: 5, w: 2, variant: 2 }, { x: 8, w: 2, variant: 2 }] },
    { type: 'water', y: 4, dir: -1, speed: 1.5, objects: [{ x: 0, w: 4, variant: 1 }, { x: 6, w: 3, variant: 0 }] },
    { type: 'water', y: 3, dir: 1, speed: 2.5, objects: [{ x: 2, w: 2, variant: 2 }, { x: 6, w: 3, variant: 0 }] },
    { type: 'water', y: 2, dir: -1, speed: 1, objects: [{ x: 0, w: 3, variant: 1 }, { x: 5, w: 2, variant: 2 }, { x: 8, w: 2, variant: 2 }] },
    { type: 'goal', y: 1 },
  ]);

  // Initialize client-side state after mount
  const [mounted, set_mounted] = useState(false);
  useEffect(() => {
    set_mounted(true);
    sound_ref.current = new SoundFX();
  }, []);


  // Load high score after mount
  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('frogger_high');
      if (saved) {
        set_high_score(parseInt(saved));
      }
    }
  }, [mounted]);

  const move = (dir: string) => {
    if (game_over_ref.current) return;
    const frog = frog_ref.current;
    let moved = false;

    if (dir === 'up' && frog.y > 0) { frog.y--; frog.facing = 'up'; moved = true; }
    if (dir === 'down' && frog.y < ROWS - 1) { frog.y++; frog.facing = 'down'; moved = true; }
    if (dir === 'left' && frog.x > 0) { frog.x--; frog.facing = 'left'; moved = true; }
    if (dir === 'right' && frog.x < COLS - 1) { frog.x++; frog.facing = 'right'; moved = true; }

    if (moved) {
      frog.hop_frame = 8; // Animation frames
      sound_ref.current?.hop();
    }

    if (frog.y <= 1) {
      score_ref.current += 100;
      set_score(score_ref.current);
      if (score_ref.current > high_score) {
        set_high_score(score_ref.current);
        localStorage.setItem('frogger_high', score_ref.current.toString());
      }
      frog_ref.current = { x: 4, y: 11, hop_frame: 0, facing: 'up' };
      sound_ref.current?.victory();
      set_message({ title: 'Nice!', text: '+100 points' });
      setTimeout(() => set_message(null), 1000);
    }
  };

  const end_game = (title: string, text: string, sound: 'splash' | 'splat') => {
    game_over_ref.current = true;
    set_game_over(true);
    set_message({ title, text });
    if (sound === 'splash') sound_ref.current?.splash();
    else sound_ref.current?.splat();
  };

  const reset_game = () => {
    frog_ref.current = { x: 4, y: 11, hop_frame: 0, facing: 'up' };
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

    // ========== PIXEL ART SPRITE DRAWING ==========

    const draw_pixel_rect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    };

    const draw_frog = (x: number, y: number, facing: string, hop_frame: number) => {
      const cx = x + GRID / 2;
      const cy = y + GRID / 2;
      const squash = hop_frame > 0 ? 1 + (hop_frame / 16) : 1;
      const stretch = hop_frame > 0 ? 1 - (hop_frame / 32) : 1;

      ctx.save();
      ctx.translate(cx, cy);

      // Rotate based on facing direction
      if (facing === 'down') ctx.rotate(Math.PI);
      else if (facing === 'left') ctx.rotate(-Math.PI / 2);
      else if (facing === 'right') ctx.rotate(Math.PI / 2);

      ctx.scale(stretch, squash);

      // Body (dark green base)
      draw_pixel_rect(-14, -10, 28, 20, '#2d5a27');

      // Body (lighter green overlay)
      draw_pixel_rect(-12, -8, 24, 16, '#4ade80');

      // Spots on back
      draw_pixel_rect(-6, -4, 4, 4, '#2d8a4e');
      draw_pixel_rect(4, 0, 3, 3, '#2d8a4e');
      draw_pixel_rect(-2, 4, 3, 3, '#2d8a4e');

      // Back legs
      draw_pixel_rect(-16, 4, 6, 8, '#3cb371');
      draw_pixel_rect(10, 4, 6, 8, '#3cb371');
      // Back feet
      draw_pixel_rect(-18, 10, 4, 4, '#2d8a4e');
      draw_pixel_rect(14, 10, 4, 4, '#2d8a4e');

      // Front legs
      draw_pixel_rect(-14, -12, 5, 6, '#3cb371');
      draw_pixel_rect(9, -12, 5, 6, '#3cb371');
      // Front feet
      draw_pixel_rect(-16, -16, 4, 4, '#2d8a4e');
      draw_pixel_rect(12, -16, 4, 4, '#2d8a4e');

      // Eyes (white)
      draw_pixel_rect(-10, -12, 7, 7, '#fff');
      draw_pixel_rect(3, -12, 7, 7, '#fff');

      // Pupils (black)
      draw_pixel_rect(-8, -11, 4, 4, '#000');
      draw_pixel_rect(5, -11, 4, 4, '#000');

      // Eye shine
      draw_pixel_rect(-7, -10, 2, 2, '#fff');
      draw_pixel_rect(6, -10, 2, 2, '#fff');

      ctx.restore();
    };

    const draw_car = (x: number, y: number, w: number, variant: number, dir: number) => {
      const colors = ['#e63946', '#f4a261', '#457b9d', '#9b5de5'];
      const bodyColor = colors[variant % colors.length];
      const width = w * GRID - 4;
      const height = GRID - 10;

      ctx.save();
      ctx.translate(x, y + 5);

      // Car body
      draw_pixel_rect(2, 0, width - 4, height, bodyColor);

      // Car top (cabin)
      const cabinStart = dir > 0 ? width * 0.5 : width * 0.15;
      draw_pixel_rect(cabinStart, -6, width * 0.35, 8, bodyColor);

      // Windows
      ctx.fillStyle = '#87ceeb';
      draw_pixel_rect(cabinStart + 2, -4, width * 0.35 - 4, 5, '#87ceeb');

      // Wheels
      draw_pixel_rect(6, height - 4, 10, 8, '#222');
      draw_pixel_rect(width - 16, height - 4, 10, 8, '#222');

      // Wheel hubs
      draw_pixel_rect(9, height - 1, 4, 2, '#666');
      draw_pixel_rect(width - 13, height - 1, 4, 2, '#666');

      // Headlights/taillights
      if (dir > 0) {
        draw_pixel_rect(width - 4, 4, 4, 6, '#ffeb3b');
        draw_pixel_rect(0, 4, 4, 6, '#ff0000');
      } else {
        draw_pixel_rect(0, 4, 4, 6, '#ffeb3b');
        draw_pixel_rect(width - 4, 4, 4, 6, '#ff0000');
      }

      ctx.restore();
    };

    const draw_truck = (x: number, y: number, w: number, variant: number, dir: number) => {
      const colors = ['#2196f3', '#4caf50', '#ff9800'];
      const bodyColor = colors[variant % colors.length];
      const width = w * GRID - 4;
      const height = GRID - 8;

      ctx.save();
      ctx.translate(x, y + 4);

      // Truck bed
      const bedStart = dir > 0 ? 0 : width * 0.25;
      draw_pixel_rect(bedStart, 0, width * 0.75, height, bodyColor);

      // Truck cabin
      const cabStart = dir > 0 ? width * 0.75 : 0;
      draw_pixel_rect(cabStart, -4, width * 0.25, height + 4, bodyColor);

      // Cabin window
      ctx.fillStyle = '#87ceeb';
      const winStart = dir > 0 ? cabStart + 4 : cabStart + 2;
      draw_pixel_rect(winStart, -2, width * 0.2 - 4, 10, '#87ceeb');

      // Wheels
      draw_pixel_rect(8, height - 2, 12, 8, '#222');
      draw_pixel_rect(width - 20, height - 2, 12, 8, '#222');

      ctx.restore();
    };

    const draw_log = (x: number, y: number, w: number, variant: number) => {
      const width = w * GRID - 4;
      const height = GRID - 16;

      ctx.save();
      ctx.translate(x, y + 8);

      // Main log body
      draw_pixel_rect(0, 0, width, height, '#8b4513');

      // Bark texture (darker lines)
      for (let i = 0; i < width; i += 12) {
        draw_pixel_rect(i, 2, 2, height - 4, '#5d3a1a');
      }

      // Log ends (lighter circles)
      draw_pixel_rect(0, 2, 6, height - 4, '#a0522d');
      draw_pixel_rect(width - 6, 2, 6, height - 4, '#a0522d');

      // Wood grain on ends
      draw_pixel_rect(2, 6, 2, height - 12, '#deb887');
      draw_pixel_rect(width - 4, 6, 2, height - 12, '#deb887');

      // Knots (occasional)
      if (variant === 0) {
        draw_pixel_rect(width / 3, 4, 6, 6, '#5d3a1a');
      }

      ctx.restore();
    };

    const draw_turtle = (x: number, y: number, w: number, time: number) => {
      const turtleWidth = GRID - 8;
      const spacing = GRID;

      for (let i = 0; i < w; i++) {
        const tx = x + i * spacing + 4;
        const ty = y + 10;

        // Shell
        draw_pixel_rect(tx, ty, turtleWidth, GRID - 20, '#2e8b57');
        draw_pixel_rect(tx + 2, ty + 2, turtleWidth - 4, GRID - 24, '#3cb371');

        // Shell pattern
        draw_pixel_rect(tx + turtleWidth / 2 - 3, ty + 4, 6, 6, '#228b22');

        // Head (bobs slightly)
        const headBob = Math.sin(time / 200 + i) * 2;
        draw_pixel_rect(tx + turtleWidth / 2 - 4, ty - 6 + headBob, 8, 8, '#3cb371');
        draw_pixel_rect(tx + turtleWidth / 2 - 2, ty - 4 + headBob, 2, 2, '#000');
        draw_pixel_rect(tx + turtleWidth / 2 + 1, ty - 4 + headBob, 2, 2, '#000');

        // Flippers
        const flipperWave = Math.sin(time / 150 + i) * 2;
        draw_pixel_rect(tx - 4, ty + 4 + flipperWave, 6, 4, '#2e8b57');
        draw_pixel_rect(tx + turtleWidth - 2, ty + 4 - flipperWave, 6, 4, '#2e8b57');
      }
    };

    const draw_lily_pad = (x: number, y: number, occupied: boolean) => {
      const cx = x + GRID / 2;
      const cy = y + GRID / 2;

      // Pad
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0.2, Math.PI * 2 - 0.2);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fillStyle = occupied ? '#ff6b6b' : '#228b22';
      ctx.fill();

      // Highlight
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 4, 4, 0, Math.PI * 2);
      ctx.fillStyle = occupied ? '#ff8a8a' : '#32cd32';
      ctx.fill();

      // Flower if occupied
      if (occupied) {
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffeb3b';
        ctx.fill();
      }
    };

    const draw_grass_texture = (y: number) => {
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(0, y, canvas.width, GRID);

      // Grass blades
      ctx.fillStyle = '#3d7a37';
      for (let i = 0; i < canvas.width; i += 8) {
        const h = 4 + Math.random() * 4;
        ctx.fillRect(i, y + GRID - h, 3, h);
      }

      // Flowers (occasional)
      ctx.fillStyle = '#ffeb3b';
      for (let i = 20; i < canvas.width; i += 80) {
        ctx.fillRect(i, y + 8, 4, 4);
      }
    };

    const draw_water_texture = (y: number, time: number) => {
      // Base water
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(0, y, canvas.width, GRID);

      // Ripples
      ctx.fillStyle = '#2a4a6b';
      for (let i = 0; i < canvas.width; i += 20) {
        const rippleOffset = Math.sin(time / 300 + i / 30) * 3;
        ctx.fillRect(i, y + 10 + rippleOffset, 12, 2);
        ctx.fillRect(i + 10, y + 25 + rippleOffset, 8, 2);
      }
    };

    const draw_road_texture = (y: number) => {
      // Asphalt
      ctx.fillStyle = '#333';
      ctx.fillRect(0, y, canvas.width, GRID);

      // Lane markings
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 3;
      ctx.setLineDash([15, 15]);
      ctx.beginPath();
      ctx.moveTo(0, y + GRID / 2);
      ctx.lineTo(canvas.width, y + GRID / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // ========== GAME LOOP ==========

    let time = 0;

    const update = () => {
      time += 16;
      const lanes = lanes_ref.current;
      const frog = frog_ref.current;

      // Decay hop animation
      if (frog.hop_frame > 0) frog.hop_frame--;

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
              if (frog.x + 0.8 > obj.x && frog.x + 0.2 < obj.x + obj.w) {
                end_game('Game Over', 'You were hit by a car!', 'splat');
                return;
              }
            }
          } else if (lane.type === 'water' && lane.objects && lane.dir && lane.speed) {
            let on_platform = false;
            for (const obj of lane.objects) {
              if (frog.x + 0.8 > obj.x && frog.x + 0.2 < obj.x + obj.w) {
                on_platform = true;
                frog.x += lane.dir * lane.speed * 0.016;
                break;
              }
            }
            if (!on_platform || frog.x < -1 || frog.x > COLS) {
              end_game('Splash!', 'You fell in the water!', 'splash');
            }
          }
        }
      }
    };

    const draw = () => {
      const lanes = lanes_ref.current;
      const frog = frog_ref.current;

      // Sky/background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const lane of lanes) {
        const y = lane.y * GRID;

        if (lane.type === 'safe') {
          draw_grass_texture(y);
        } else if (lane.type === 'goal') {
          ctx.fillStyle = '#1b4332';
          ctx.fillRect(0, y, canvas.width, GRID);
          // Lily pads at goal positions
          for (let i = 1; i < COLS; i += 2) {
            draw_lily_pad(i * GRID, y, false);
          }
        } else if (lane.type === 'road' && lane.objects) {
          draw_road_texture(y);
          for (const obj of lane.objects) {
            if (obj.w >= 3) {
              draw_truck(obj.x * GRID, y, obj.w, obj.variant || 0, lane.dir || 1);
            } else {
              draw_car(obj.x * GRID, y, obj.w, obj.variant || 0, lane.dir || 1);
            }
          }
        } else if (lane.type === 'water' && lane.objects) {
          draw_water_texture(y, time);
          for (const obj of lane.objects) {
            // Variant 2 = turtles, others = logs
            if ((obj.variant || 0) === 2) {
              draw_turtle(obj.x * GRID, y, obj.w, time);
            } else {
              draw_log(obj.x * GRID, y, obj.w, obj.variant || 0);
            }
          }
        }
      }

      // Draw frog
      draw_frog(frog.x * GRID, frog.y * GRID, frog.facing, frog.hop_frame);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [high_score]); // move uses refs intentionally to avoid stale closures

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
        <NavTabs />
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
