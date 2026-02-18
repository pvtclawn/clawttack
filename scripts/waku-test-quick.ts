const NWAKU_REST = 'http://127.0.0.1:8003';
const CONTENT_TOPIC = '/clawttack/1/test-local/proto';

async function main() {
  // Get nwaku peer ID
  const infoRes = await fetch(`${NWAKU_REST}/debug/v1/info`);
  const info = await infoRes.json() as { listenAddresses: string[] };
  const wsAddr = info.listenAddresses?.find((a: string) => a.includes('/ws/'));
  const peerId = wsAddr!.split('/p2p/')[1];
  const multiaddr = `/ip4/127.0.0.1/tcp/8645/ws/p2p/${peerId}`;
  console.log('nwaku:', multiaddr);

  const { createLightNode, Protocols } = await import('@waku/sdk');

  const nodeOpts = {
    bootstrapPeers: [multiaddr],
    networkConfig: { clusterId: 42, shards: [0] },
    libp2p: { filterMultiaddrs: false, hideWebSocketInfo: true },
  };

  // Node A
  const nodeA = await createLightNode(nodeOpts);
  await nodeA.start();
  console.log('Node A started');

  // Node B
  const nodeB = await createLightNode(nodeOpts);
  await nodeB.start();
  console.log('Node B started');

  // Wait for connection
  console.log('Waiting 5s for peer connections...');
  await new Promise(r => setTimeout(r, 5000));
  
  const peersABefore = nodeA.libp2p.getPeers();
  const peersBBefore = nodeB.libp2p.getPeers();
  console.log(`Peers — A: ${peersABefore.length}, B: ${peersBBefore.length}`);
  
  // Debug protocols
  for (const p of peersABefore) {
    try {
      const peerInfo = await nodeA.libp2p.peerStore.get(p);
      console.log('Node A → nwaku protocols:', peerInfo.protocols);
    } catch(e: any) { console.log('Peer info error:', e.message); }
  }

  // Wait for specific protocols
  console.log('Waiting for LightPush + Filter protocols...');
  try {
    await Promise.all([
      nodeA.waitForPeers([Protocols.LightPush], AbortSignal.timeout(15000)),
      nodeB.waitForPeers([Protocols.Filter], AbortSignal.timeout(15000)),
    ]);
    console.log('✅ Protocol peers ready');
  } catch (e: any) {
    console.error('❌ Protocol wait failed:', e.message);
    
    // Debug: list protocols on connected peers
    const peersA = nodeA.libp2p.getPeers();
    console.log('Connected peers:', peersA.length);
    for (const p of peersA) {
      try {
        const peerInfo = await nodeA.libp2p.peerStore.get(p);
        console.log('Peer', p.toString().slice(-8), 'protocols:', peerInfo.protocols);
      } catch(e2: any) { console.log('Could not get peer info:', e2.message); }
    }
    await nodeA.stop(); await nodeB.stop();
    process.exit(1);
  }

  // Subscribe
  const decoder = nodeB.createDecoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
  let got = '';
  await nodeB.filter.subscribe([decoder], (msg: any) => {
    if (msg.payload) got = new TextDecoder().decode(msg.payload);
  });
  console.log('Subscribed');

  // Send
  const encoder = nodeA.createEncoder({ contentTopic: CONTENT_TOPIC, shardId: 0 });
  const result = await nodeA.lightPush.send(encoder, {
    payload: new TextEncoder().encode(JSON.stringify({ hello: 'world', ts: Date.now() })),
  });
  console.log('Send result:', JSON.stringify(result));

  await new Promise(r => setTimeout(r, 3000));
  console.log('Received:', got || '(nothing)');

  await nodeA.stop(); await nodeB.stop();
}

main().catch(console.error);
