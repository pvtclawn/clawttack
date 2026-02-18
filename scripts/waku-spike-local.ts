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
const NWAKU_REST = 'http://127.0.0.1:8003';
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
    // Find the WebSocket multiaddr and replace Docker IP with localhost
    const wsAddr = info.listenAddresses?.find(a => a.includes('/ws/'));
    if (wsAddr) {
      const peerId = wsAddr.split('/p2p/')[1];
      nwakuMultiaddr = `/ip4/127.0.0.1/tcp/8645/ws/p2p/${peerId}`;
    } else {
      nwakuMultiaddr = NWAKU_WS;
    }
    console.log('   📍 nwaku multiaddr:', nwakuMultiaddr);
  } catch {
    nwakuMultiaddr = NWAKU_WS;
    console.log('   Using default multiaddr:', nwakuMultiaddr);
  }

  const { createLightNode } = await import('@waku/sdk');

  // 1. Create two light nodes pointing at our local nwaku (cluster 42 = private, no RLN)
  const nodeOpts = {
    bootstrapPeers: [nwakuMultiaddr],
    networkConfig: { clusterId: 42, contentTopics: [CONTENT_TOPIC] },
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  };

  console.log('\n1️⃣  Creating Node A (bootstrap → local nwaku, cluster 42)...');
  const nodeA = await createLightNode(nodeOpts);
  await nodeA.start();
  console.log('   ✅ Node A started');

  console.log('2️⃣  Creating Node B (bootstrap → local nwaku, cluster 42)...');
  const nodeB = await createLightNode(nodeOpts);
  await nodeB.start();
  console.log('   ✅ Node B started');

  // 2. Give nodes time to connect (skip waitForRemotePeer which is flaky)
  console.log('3️⃣  Waiting 5s for peer connections...');
  await new Promise(r => setTimeout(r, 5000));
  
  // Check connected peers
  const peersA = nodeA.libp2p?.getPeers?.() ?? [];
  const peersB = nodeB.libp2p?.getPeers?.() ?? [];
  console.log(`   Node A peers: ${peersA.length}, Node B peers: ${peersB.length}`);
  
  if (peersA.length === 0 && peersB.length === 0) {
    console.error('   ❌ No peers connected. Check nwaku WebSocket config.');
    await cleanup(nodeA, nodeB);
    process.exit(1);
  }
  console.log('   ✅ Peers found');

  // 3. Node B subscribes (use node's decoder for correct routing)
  console.log('4️⃣  Node B subscribing to filter...');
  const PUBSUB_TOPIC = '/waku/2/rs/42/0';
  const decoder = nodeB.createDecoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
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

  // 4. Node A sends (use node's encoder for correct routing)
  console.log('5️⃣  Node A sending via Light Push...');
  const encoder = nodeA.createEncoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
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
