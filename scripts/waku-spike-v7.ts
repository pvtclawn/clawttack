/**
 * Waku Spike v7 — Manual delay + REST publish + JS filter
 */
const NWAKU_REST = 'http://127.0.0.1:8003';
const CONTENT_TOPIC = '/clawttack/1/test-local/proto';

async function main() {
  console.log('🔌 Waku Spike v7\n');

  const infoRes = await fetch(`${NWAKU_REST}/debug/v1/info`);
  const info = await infoRes.json() as { listenAddresses: string[] };
  const wsAddr = info.listenAddresses?.find((a: string) => a.includes('/ws/'));
  const peerId = wsAddr!.split('/p2p/')[1];
  const multiaddr = `/ip4/127.0.0.1/tcp/8645/ws/p2p/${peerId}`;
  console.log('nwaku:', multiaddr);

  const { createLightNode } = await import('@waku/sdk');

  // Create node
  const node = await createLightNode({
    bootstrapPeers: [multiaddr],
    networkConfig: { clusterId: 42, shards: [0] },
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  });
  await node.start();
  console.log('✅ Node started');

  // Wait for connection
  console.log('⏳ Waiting 8s for peer connection...');
  await new Promise(r => setTimeout(r, 8000));
  
  const peers = node.libp2p.getPeers();
  console.log(`Peers: ${peers.length}`);
  if (peers.length === 0) { console.error('❌ No peers'); process.exit(1); }

  // Subscribe via filter
  console.log('📡 Subscribing via filter...');
  const decoder = node.createDecoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
  let received = '';
  
  try {
    await node.filter.subscribe([decoder], (msg: any) => {
      if (msg.payload) {
        received = new TextDecoder().decode(msg.payload);
        console.log(`📥 RECEIVED: ${received}`);
      }
    });
    console.log('✅ Subscribed');
  } catch (err: any) {
    console.error('❌ Subscribe failed:', err.message);
    process.exit(1);
  }

  // Wait a moment for subscription to register on nwaku side
  await new Promise(r => setTimeout(r, 2000));

  // Publish via REST API
  console.log('📤 Publishing via REST...');
  const msg = { type: 'turn', battle: 'test-001', ts: Date.now(), text: 'Hello P2P 🦞' };
  const payload = Buffer.from(JSON.stringify(msg)).toString('base64');
  
  const pubRes = await fetch(`${NWAKU_REST}/relay/v1/auto/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, contentTopic: CONTENT_TOPIC }),
  });
  console.log(`REST: ${pubRes.status} ${await pubRes.text()}`);

  // Wait for delivery
  console.log('⏳ Waiting 5s...');
  await new Promise(r => setTimeout(r, 5000));

  if (received) {
    console.log('\n🎉 SUCCESS — Filter received message published via REST!');
  } else {
    console.log('\n⚠️ Not received. Checking nwaku logs...');
  }

  await node.stop();
}

main().catch(console.error);
