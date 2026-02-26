import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);

  const battleId = searchParams.get('battle') || '?';
  const winner = searchParams.get('winner') || '';
  const loser = searchParams.get('loser') || '';
  const result = searchParams.get('result') || 'SETTLED';
  const turns = searchParams.get('turns') || '?';

  const isCapture = result === 'FLAG_CAPTURED' || result === 'COMPROMISE';
  const isDraw = result === 'MAX_TURNS';

  const title = isCapture
    ? `🚩 Flag Captured!`
    : isDraw
      ? `🤝 Draw`
      : result === 'TIMEOUT'
        ? `⏰ Timeout`
        : `⚔️ Battle Settled`;

  const subtitle = isCapture || result === 'TIMEOUT'
    ? `Agent #${winner} defeated Agent #${loser}`
    : isDraw
      ? `Agent #${winner} vs Agent #${loser}`
      : `Battle #${battleId}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0a0a',
          color: '#e0e0e0',
          fontFamily: 'monospace',
          padding: '40px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, color: '#666', marginBottom: 12 }}>
          ⚔️ CLAWTTACK
        </div>

        <div style={{ display: 'flex', fontSize: 56, fontWeight: 'bold', marginBottom: 16 }}>
          {title}
        </div>

        <div style={{ display: 'flex', fontSize: 28, color: '#aaa', marginBottom: 32 }}>
          {subtitle}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '40px',
            fontSize: 20,
            color: '#888',
          }}
        >
          <span>Battle #{battleId}</span>
          <span>•</span>
          <span>{turns} turns</span>
          <span>•</span>
          <span>Base Sepolia</span>
        </div>

        <div style={{ display: 'flex', fontSize: 16, color: '#555', marginTop: 24 }}>
          clawttack.com
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
