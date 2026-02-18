/**
 * Waku Spike v8 — Explicit pubsub topic for both publish + subscribe
 */
const NWAKU_REST = 'http://127.0.0.1:8003';
const CONTENT_TOPIC = '/clawttack/1/test-local/proto';
const PUBSUB_TOPIC = '/waku/2/rs/42/0';

async function main() {
  console.log('🔌 Waku Spike v8 — Shard-aligned\n');

  const infoRes = await fetch(`${NWAKU_REST}/debug/v1/info`);
  const info = await infoRes.json() as { listenAddresses: string[] };
  const wsAddr = info.listenAddresses?.find((a: string) => a.includes('/ws/'));
  const peerId = wsAddr!.split('/p2p/')[1];
  const multiaddr = `/ip4/127.0.0.1/tcp/8645/ws/p2p/${peerId}`;
  console.log('nwaku:', multiaddr);

  const { createLightNode } = await import('@waku/sdk');

  const node = await createLightNode({
    bootstrapPeers: [multiaddr],
    networkConfig: { clusterId: 42, shards: [0] },
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  });
  await node.start();

  // Wait for connection
  await new Promise(r => setTimeout(r, 6000));
  const peers = node.libp2p.getPeers();
  console.log(`Peers: ${peers.length}`);
  if (!peers.length) { console.error('❌ No peers'); process.exit(1); }

  // Subscribe
  const decoder = node.createDecoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
  let received = '';
  await node.filter.subscribe([decoder], (msg: any) => {
    if (msg.payload) {
      received = new TextDecoder().decode(msg.payload);
      console.log(`📥 RECEIVED: ${received}`);
    }
  });
  console.log('✅ Subscribed on shard 0');

  // Wait for sub to register on nwaku
  await new Promise(r => setTimeout(r, 2000));

  // Publish via REST with EXPLICIT pubsub topic (shard 0, not auto)
  const msg = { type: 'turn', battle: 'test-001', ts: Date.now(), text: 'Hello P2P 🦞' };
  const payload = Buffer.from(JSON.stringify(msg)).toString('base64');
  const encodedTopic = encodeURIComponent(PUBSUB_TOPIC);

  const pubRes = await fetch(`${NWAKU_REST}/relay/v1/messages/${encodedTopic}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, contentTopic: CONTENT_TOPIC }),
  });
  console.log(`📤 Published: ${pubRes.status} ${await pubRes.text()}`);

  // Wait for delivery
  console.log('⏳ Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));

  if (received) {
    console.log('\n🎉 SUCCESS — P2P MESSAGING WORKS!');
    console.log('   Received:', received);
  } else {
    console.log('\n⚠️ Not received');
  }

  await node.stop();
}

main().catch(console.error);
