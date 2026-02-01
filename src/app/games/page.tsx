/**
 * Games landing page
 * Lists all available games
 */

'use client';

import Link from 'next/link';

export default function GamesPage() {
  const games = [
    {
      name: 'Frogger',
      description: 'Classic arcade game. Help the frog cross the road and river!',
      href: '/games/frogger',
      emoji: '🐸',
    },
  ];

  return (
    <div className="games-page">
      <style jsx>{`
        .games-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #e4e4e4;
          padding: 40px 20px;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
        }
        h1 {
          text-align: center;
          color: #00d9ff;
          font-weight: 300;
          font-size: 2.5em;
          margin-bottom: 10px;
        }
        .subtitle {
          text-align: center;
          color: #666;
          margin-bottom: 40px;
        }
        .games-grid {
          display: grid;
          gap: 20px;
        }
        .game-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s ease;
        }
        .game-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: #00d9ff;
          transform: translateY(-2px);
        }
        .game-emoji {
          font-size: 3em;
        }
        .game-info h2 {
          color: #fff;
          margin: 0 0 8px 0;
          font-size: 1.3em;
        }
        .game-info p {
          color: #888;
          margin: 0;
          font-size: 0.95em;
        }
        .back-link {
          display: inline-block;
          margin-bottom: 30px;
          color: #666;
          text-decoration: none;
          font-size: 0.9em;
        }
        .back-link:hover {
          color: #00d9ff;
        }
      `}</style>

      <div className="container">
        <Link href="/" className="back-link">← Back to 8i11</Link>
        <h1>Games</h1>
        <p className="subtitle">Take a break and have some fun</p>

        <div className="games-grid">
          {games.map((game) => (
            <Link key={game.href} href={game.href} className="game-card">
              <span className="game-emoji">{game.emoji}</span>
              <div className="game-info">
                <h2>{game.name}</h2>
                <p>{game.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
