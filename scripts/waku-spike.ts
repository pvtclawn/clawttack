#!/usr/bin/env bun
/**
 * Waku Spike — Test if we can send/receive on the Waku network
 * 
 * This tests the raw Waku SDK, not our WakuTransport wrapper.
 * If this works, WakuTransport will work too.
 * 
 * Usage: bun scripts/waku-spike.ts
 */

const CONTENT_TOPIC = '/clawttack/1/test-spike/proto';
const TIMEOUT_MS = 30_000;

async function main() {
  console.log('🔌 Waku Spike — Testing P2P messaging\n');

  // Dynamic import
  const { createLightNode, waitForRemotePeer, createEncoder, createDecoder } = await import('@waku/sdk');

  // 1. Create two light nodes (simulating two agents)
  console.log('1️⃣  Creating Node A...');
  const nodeA = await createLightNode({
    defaultBootstrap: true,
    networkConfig: { clusterId: 1, contentTopics: [CONTENT_TOPIC] },
    libp2p: { filterMultiaddrs: false },
  });
  await nodeA.start();
  console.log('   ✅ Node A started');

  console.log('2️⃣  Creating Node B...');
  const nodeB = await createLightNode({
    defaultBootstrap: true,
    networkConfig: { clusterId: 1, contentTopics: [CONTENT_TOPIC] },
    libp2p: { filterMultiaddrs: false },
  });
  await nodeB.start();
  console.log('   ✅ Node B started');

  // 2. Wait for peers
  console.log('3️⃣  Waiting for remote peers...');
  const peerTimeout = AbortSignal.timeout(TIMEOUT_MS);
  
  try {
    await Promise.all([
      waitForRemotePeer(nodeA, undefined, peerTimeout),
      waitForRemotePeer(nodeB, undefined, peerTimeout),
    ]);
    console.log('   ✅ Both nodes connected to Waku network');
  } catch (err) {
    console.error('   ❌ Peer discovery failed:', err);
    await cleanup(nodeA, nodeB);
    process.exit(1);
  }

  // 3. Node B subscribes to receive messages
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

  // 4. Node A sends a message via Light Push
  console.log('5️⃣  Node A sending via Light Push...');
  const encoder = createEncoder({ contentTopic: CONTENT_TOPIC });
  const testMessage = JSON.stringify({
    type: 'test',
    from: 'nodeA',
    timestamp: Date.now(),
    message: 'Hello from Clawttack! 🦞',
  });
  const payload = new TextEncoder().encode(testMessage);

  try {
    const result = await nodeA.lightPush.send(encoder, { payload });
    console.log('   📤 Light Push result:', JSON.stringify(result));

    if (result.successes && result.successes.length > 0) {
      console.log('   ✅ Message sent successfully!');
    } else if (result.failures && result.failures.length > 0) {
      console.error('   ❌ Light Push failed:', JSON.stringify(result.failures));
      
      // Try with auto-sharding
      console.log('\n6️⃣  Retrying with auto-sharding...');
      const autoEncoder = createEncoder({
        contentTopic: CONTENT_TOPIC,
        pubsubTopicShardInfo: { clusterId: 1, shard: 0 },
      });
      const retryResult = await nodeA.lightPush.send(autoEncoder, { payload });
      console.log('   📤 Auto-shard result:', JSON.stringify(retryResult));
      
      if (retryResult.successes && retryResult.successes.length > 0) {
        console.log('   ✅ Auto-sharding worked!');
      } else {
        console.error('   ❌ Auto-sharding also failed');
      }
    }
  } catch (err) {
    console.error('   ❌ Light Push threw:', err);
  }

  // 5. Wait a bit for message delivery
  console.log('\n⏳ Waiting 10s for message delivery...');
  await new Promise(r => setTimeout(r, 10_000));

  if (received) {
    console.log('\n🎉 SUCCESS — Waku P2P messaging works!');
    console.log('   Message received:', receivedMessage);
  } else {
    console.log('\n⚠️  Message sent but not received by Node B');
    console.log('   Possible causes: different shards, filter relay mismatch, network delay');
  }

  await cleanup(nodeA, nodeB);
}

async function cleanup(...nodes: any[]) {
  for (const node of nodes) {
    try { await node.stop(); } catch { /* ignore */ }
  }
}

main().catch(console.error);
