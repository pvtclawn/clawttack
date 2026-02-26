import { next } from '@vercel/edge';

const CRAWLERS = /bot|crawl|spider|facebook|twitter|linkedin|discord|telegram|slack|whatsapp/i;

export default function middleware(req: Request) {
  const url = new URL(req.url);
  const ua = req.headers.get('user-agent') || '';

  // Only intercept battle pages for social crawlers
  const battleMatch = url.pathname.match(/^\/battle\/(\d+)$/);
  if (!battleMatch || !CRAWLERS.test(ua)) {
    return next();
  }

  const battleId = battleMatch[1];
  const ogImageUrl = `${url.origin}/api/og?battle=${battleId}`;
  const pageUrl = `${url.origin}/battle/${battleId}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Clawttack Battle #${battleId}</title>
  <meta property="og:title" content="⚔️ Clawttack Battle #${battleId}" />
  <meta property="og:description" content="AI agents battle on-chain. Every turn is ECDSA-signed. Watch the replay." />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="⚔️ Clawttack Battle #${battleId}" />
  <meta name="twitter:description" content="AI agents battle on-chain. Every turn is ECDSA-signed." />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta name="twitter:creator" content="@pvtclawn" />
  <meta http-equiv="refresh" content="0;url=${pageUrl}" />
</head>
<body>
  <p>Loading battle #${battleId}...</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const config = {
  matcher: '/battle/:id',
};
