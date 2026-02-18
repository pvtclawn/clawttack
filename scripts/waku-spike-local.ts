#!/usr/bin/env bun
/**
 * Waku Spike v5 — Test with local nwaku relay node
 * 
 * Prerequisites: nwaku running locally
 *   docker run -d --name nwaku \
 *     -p 127.0.0.1:8645:8645 \
 *     -p 127.0.0.1:60000:60000 \
 *     ghcr.io/logos-messaging/logos-delivery:latest \
 *     --websocket-support=true --websocket-port=8645 \
 *     --rest=true --rest-address=0.0.0.0
 * 
 * Usage: bun scripts/waku-spike-local.ts
 */

const NWAKU_WS = '/ip4/127.0.0.1/tcp/8645/ws';
const NWAKU_REST = 'http://127.0.0.1:8645';
const CONTENT_TOPIC = '/clawttack/1/test-local/proto';

async function main() {
  console.log('🔌 Waku Spike v5 — Local nwaku node\n');

  // 0. Check if nwaku is running
  console.log('0️⃣  Checking nwaku REST API...');
  try {
    const health = await fetch(`${NWAKU_REST}/health`, { signal: AbortSignal.timeout(3000) });
    if (health.ok) {
      console.log('   ✅ nwaku is running');
    } else {
      console.log(`   ⚠️  nwaku responded with ${health.status}`);
    }
  } catch {
    console.error('   ❌ nwaku not reachable at', NWAKU_REST);
    console.error('   Run: docker run -d --name nwaku -p 127.0.0.1:8645:8645 ghcr.io/logos-messaging/logos-delivery:latest --websocket-support=true --websocket-port=8645 --rest=true --rest-address=0.0.0.0');
    process.exit(1);
  }

  // Get nwaku's multiaddr for bootstrapping
  console.log('   Fetching nwaku peer info...');
  let nwakuMultiaddr: string;
  try {
    const infoRes = await fetch(`${NWAKU_REST}/debug/v1/info`);
    const info = await infoRes.json() as { listenAddresses: string[] };
    // Find the WebSocket multiaddr
    nwakuMultiaddr = info.listenAddresses?.find(a => a.includes('/ws')) ?? NWAKU_WS;
    console.log('   📍 nwaku multiaddr:', nwakuMultiaddr);
  } catch {
    nwakuMultiaddr = NWAKU_WS;
    console.log('   Using default multiaddr:', nwakuMultiaddr);
  }

  const { createLightNode, waitForRemotePeer, createEncoder, createDecoder } = await import('@waku/sdk');

  // 1. Create two light nodes pointing at our local nwaku
  console.log('\n1️⃣  Creating Node A (bootstrap → local nwaku)...');
  const nodeA = await createLightNode({
    bootstrapPeers: [nwakuMultiaddr],
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  });
  await nodeA.start();
  console.log('   ✅ Node A started');

  console.log('2️⃣  Creating Node B (bootstrap → local nwaku)...');
  const nodeB = await createLightNode({
    bootstrapPeers: [nwakuMultiaddr],
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  });
  await nodeB.start();
  console.log('   ✅ Node B started');

  // 2. Wait for peers (should be fast with local bootstrap)
  console.log('3️⃣  Waiting for remote peers...');
  try {
    await Promise.all([
      waitForRemotePeer(nodeA, undefined, AbortSignal.timeout(10_000)),
      waitForRemotePeer(nodeB, undefined, AbortSignal.timeout(10_000)),
    ]);
    console.log('   ✅ Both nodes peered with nwaku');
  } catch (err) {
    console.error('   ❌ Peer connection failed:', err);
    await cleanup(nodeA, nodeB);
    process.exit(1);
  }

  // 3. Node B subscribes
  console.log('4️⃣  Node B subscribing to filter...');
  const decoder = createDecoder(CONTENT_TOPIC);
  let received = false;
  let receivedMessage = '';

  try {
    await nodeB.filter.subscribe(
      [decoder],
      (message: any) => {
        if (message.payload) {
          receivedMessage = new TextDecoder().decode(message.payload);
          received = true;
          console.log(`   📥 Node B received: ${receivedMessage}`);
        }
      },
    );
    console.log('   ✅ Node B subscribed');
  } catch (err) {
    console.error('   ❌ Filter subscribe failed:', err);
    await cleanup(nodeA, nodeB);
    process.exit(1);
  }

  // 4. Node A sends
  console.log('5️⃣  Node A sending via Light Push...');
  const encoder = createEncoder({ contentTopic: CONTENT_TOPIC });
  const testMessage = JSON.stringify({
    type: 'turn',
    battleId: 'test-local-001',
    sender: '0xTestAgent',
    timestamp: Date.now(),
    payload: { message: 'Hello from Clawttack P2P! 🦞', turnNumber: 1 },
  });

  try {
    const result = await nodeA.lightPush.send(encoder, {
      payload: new TextEncoder().encode(testMessage),
    });

    if (result.successes && result.successes.length > 0) {
      console.log('   ✅ Message sent!', `(${result.successes.length} success)`);
    } else {
      console.error('   ❌ Send failed:', JSON.stringify(result.failures));
    }
  } catch (err) {
    console.error('   ❌ Light Push threw:', err);
  }

  // 5. Wait for delivery
  console.log('\n⏳ Waiting 5s for delivery...');
  await new Promise(r => setTimeout(r, 5_000));

  if (received) {
    console.log('\n🎉 SUCCESS — P2P messaging works via local nwaku!');
    console.log('   Message:', receivedMessage);
    console.log('\n   Next: wire this into WakuTransport + run a real battle');
  } else {
    console.log('\n⚠️  Message sent but not received');
    console.log('   Check nwaku logs: docker logs nwaku');
  }

  await cleanup(nodeA, nodeB);
}

async function cleanup(...nodes: any[]) {
  for (const node of nodes) {
    try { await node.stop(); } catch { /* ignore */ }
  }
}

main().catch(console.error);
