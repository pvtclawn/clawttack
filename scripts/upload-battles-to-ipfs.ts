#!/usr/bin/env bun
// scripts/upload-battles-to-ipfs.ts — Migrate static battle JSONs to IPFS
//
// Reads all battle logs from web/public/battles/, uploads to Pinata,
// and outputs a mapping file of battleId → IPFS CID.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const secretsPath = join(process.env.HOME ?? '/home/clawn', '.config/pvtclawn/secrets.json');
const secrets = JSON.parse(readFileSync(secretsPath, 'utf-8'));

const PINATA_KEY = secrets.PINATA_API_KEY;
const PINATA_SECRET = secrets.PINATA_API_SECRET;

if (!PINATA_KEY || !PINATA_SECRET) {
  console.error('❌ Missing PINATA_API_KEY or PINATA_API_SECRET');
  process.exit(1);
}

const battlesDir = join(import.meta.dir, '..', 'packages', 'web', 'public', 'battles');
const files = readdirSync(battlesDir).filter(f => f.endsWith('.json'));

console.log(`📦 Uploading ${files.length} battle logs to IPFS via Pinata...\n`);

const mapping: Record<string, { cid: string; filename: string; size: number }> = {};
let uploaded = 0;
let failed = 0;

for (const file of files) {
  const path = join(battlesDir, file);
  const content = JSON.parse(readFileSync(path, 'utf-8'));
  const battleId = content.battleId ?? file.replace('.json', '');

  try {
    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_KEY,
        'pinata_secret_api_key': PINATA_SECRET,
      },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: {
          name: `clawttack-battle-${battleId.slice(0, 16)}.json`,
          keyvalues: {
            battleId,
            project: 'clawttack',
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status}: ${err.slice(0, 100)}`);
    }

    const result = await res.json() as { IpfsHash: string; PinSize: number };
    mapping[battleId] = {
      cid: result.IpfsHash,
      filename: file,
      size: result.PinSize,
    };
    uploaded++;
    console.log(`  ✅ ${file} → ${result.IpfsHash} (${result.PinSize} bytes)`);
  } catch (err: any) {
    failed++;
    console.error(`  ❌ ${file}: ${err.message}`);
  }

  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 200));
}

// Save mapping
const mappingDir = join(import.meta.dir, '..', 'data');
mkdirSync(mappingDir, { recursive: true });
const mappingPath = join(mappingDir, 'ipfs-battle-mapping.json');
writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

console.log(`\n📊 Results: ${uploaded} uploaded, ${failed} failed`);
console.log(`📄 Mapping saved: ${mappingPath}`);
