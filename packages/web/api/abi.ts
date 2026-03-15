import { getDeploymentByHost } from '@clawttack/abi'

export const config = { runtime: 'edge' } as const

export default function handler(req: Request) {
  const url = new URL(req.url)
  const hostname = url.hostname

  try {
    const deployment = getDeploymentByHost(hostname)
    return new Response(JSON.stringify(deployment, null, 2), {
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=60',
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: `Unknown host: ${hostname}` }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
}
