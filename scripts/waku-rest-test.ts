/**
 * Waku Spike v6 — REST API publish + JS filter subscribe
 * Hybrid: publish via nwaku REST, subscribe via JS SDK filter
 */

const NWAKU_REST = 'http://127.0.0.1:8003';
const CONTENT_TOPIC = '/clawttack/1/test-local/proto';

async function main() {
  console.log('🔌 Waku Spike v6 — REST publish + JS filter\n');

  // 0. Get nwaku multiaddr
  const infoRes = await fetch(`${NWAKU_REST}/debug/v1/info`);
  const info = await infoRes.json() as { listenAddresses: string[] };
  const wsAddr = info.listenAddresses?.find((a: string) => a.includes('/ws/'));
  const peerId = wsAddr!.split('/p2p/')[1];
  const multiaddr = `/ip4/127.0.0.1/tcp/8645/ws/p2p/${peerId}`;
  console.log('nwaku:', multiaddr);

  const { createLightNode, Protocols } = await import('@waku/sdk');

  // 1. Create subscriber node
  console.log('1️⃣  Creating subscriber node...');
  const node = await createLightNode({
    bootstrapPeers: [multiaddr],
    networkConfig: { clusterId: 42, shards: [0] },
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  });
  await node.start();
  console.log('   ✅ Started');

  // 2. Wait for filter protocol
  console.log('2️⃣  Waiting for filter peer...');
  await node.waitForPeers([Protocols.Filter], AbortSignal.timeout(10000));
  console.log('   ✅ Filter peer found');

  // 3. Subscribe
  console.log('3️⃣  Subscribing...');
  const decoder = node.createDecoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
  let received = '';
  await node.filter.subscribe([decoder], (msg: any) => {
    if (msg.payload) {
      received = new TextDecoder().decode(msg.payload);
      console.log(`   📥 RECEIVED: ${received}`);
    }
  });
  console.log('   ✅ Subscribed');

  // 4. Publish via REST API
  console.log('4️⃣  Publishing via nwaku REST...');
  const payload = Buffer.from(JSON.stringify({
    type: 'turn',
    battleId: 'test-001',
    sender: '0xTestAgent',
    timestamp: Date.now(),
    message: 'Hello P2P! 🦞',
  })).toString('base64');

  const pubRes = await fetch(`${NWAKU_REST}/relay/v1/auto/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload, contentTopic: CONTENT_TOPIC }),
  });
  console.log(`   REST response: ${pubRes.status} ${await pubRes.text()}`);

  // 5. Wait
  console.log('\n⏳ Waiting 5s for delivery...');
  await new Promise(r => setTimeout(r, 5000));

  if (received) {
    console.log('\n🎉 SUCCESS — P2P messaging works!');
    console.log('   Message:', received);
  } else {
    console.log('\n⚠️  Not received via filter');
    
    // Try store query as backup
    console.log('   Trying REST relay/get...');
  }

  await node.stop();
}

main().catch(console.error);
