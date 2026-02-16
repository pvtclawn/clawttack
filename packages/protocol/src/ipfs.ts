// src/services/ipfs.ts — IPFS upload service for battle logs
//
// Uploads signed battle logs to IPFS for permanent, verifiable storage.
// The CID is stored on-chain during settlement.
//
// Supports multiple backends via IIPFSProvider interface:
// - PinataProvider: Pinata API (free tier: 1GB)
// - LocalProvider: Write to filesystem (dev/testing)

import type { BattleLog } from './types.ts';

/** IPFS provider interface */
export interface IIPFSProvider {
  readonly name: string;
  /** Upload JSON data, returns CID */
  upload(data: unknown, filename?: string): Promise<string>;
  /** Check if a CID is pinned/available */
  isPinned(cid: string): Promise<boolean>;
}

/** Pinata API provider */
export class PinataProvider implements IIPFSProvider {
  readonly name = 'pinata';
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.pinata.cloud';

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async upload(data: unknown, filename?: string): Promise<string> {
    const body = JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: filename ?? `clawttack-battle-${Date.now()}.json`,
      },
    });

    const response = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: this.apiKey,
        pinata_secret_api_key: this.apiSecret,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed (${response.status}): ${error}`);
    }

    const result = (await response.json()) as { IpfsHash: string };
    return result.IpfsHash;
  }

  async isPinned(cid: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/data/pinList?hashContains=${cid}&status=pinned`,
      {
        headers: {
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.apiSecret,
        },
      },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { count: number };
    return result.count > 0;
  }
}

/** Local filesystem provider (for testing) */
export class LocalIPFSProvider implements IIPFSProvider {
  readonly name = 'local';
  private outputDir: string;
  private files = new Map<string, string>(); // cid → path

  constructor(outputDir: string = './data/ipfs') {
    this.outputDir = outputDir;
  }

  async upload(data: unknown, filename?: string): Promise<string> {
    const content = JSON.stringify(data, null, 2);
    // Simulate CID with content hash
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(content));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const cid = 'bafy' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 55);

    const fname = filename ?? `battle-${Date.now()}.json`;
    const path = `${this.outputDir}/${fname}`;

    // Ensure directory exists
    const { mkdir, writeFile } = await import('fs/promises');
    await mkdir(this.outputDir, { recursive: true });
    await writeFile(path, content, 'utf-8');

    this.files.set(cid, path);
    return cid;
  }

  async isPinned(cid: string): Promise<boolean> {
    return this.files.has(cid);
  }

  /** Get the local path for a CID (testing helper) */
  getPath(cid: string): string | undefined {
    return this.files.get(cid);
  }
}

/** IPFS service — wraps a provider with battle-log-specific logic */
export class IPFSService {
  private provider: IIPFSProvider;

  constructor(provider: IIPFSProvider) {
    this.provider = provider;
  }

  /** Upload a battle log to IPFS */
  async uploadBattleLog(log: BattleLog): Promise<string> {
    const filename = `battle-${log.battleId}.json`;
    return this.provider.upload(log, filename);
  }

  /** Check if a battle log is available */
  async isAvailable(cid: string): Promise<boolean> {
    return this.provider.isPinned(cid);
  }

  /** Fetch a battle log from IPFS gateway */
  async fetchBattleLog(cid: string, gateway = 'https://gateway.pinata.cloud'): Promise<BattleLog> {
    const response = await fetch(`${gateway}/ipfs/${cid}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS (${response.status})`);
    }
    return (await response.json()) as BattleLog;
  }
}
