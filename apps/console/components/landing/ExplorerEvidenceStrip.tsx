import { existsSync } from 'node:fs';
import path from 'node:path';

import { ExternalLink } from 'lucide-react';


/**
 * Explorer evidence strip — docs/LANDING_PAGE_SPEC.md §5.2.
 *
 * The credibility centerpiece: the real deployed AttackToken's name() field
 * carries a live prompt-injection payload, and this section reads it off Arc
 * testnet at request time via a plain eth_call — the same way
 * packages/attack-corpus/harness/naive-agent-claude.ts does, and the same
 * "real read, honest failure" pattern as apps/console/app/log/page.tsx.
 *
 * Deliberately NOT hardcoded: if the RPC read fails we say so rather than
 * printing a canned copy of the expected string. A hardcoded fallback would
 * make the section indistinguishable from a mockup, which defeats its point.
 */
export const dynamic = 'force-dynamic';

const ATTACK_TOKEN_ADDRESS = '0x117E83CC8DcB5fe9D4F5a82c86B3bCe6c9355Ff5';
const EXPLORER_URL = `https://testnet.arcscan.app/address/${ATTACK_TOKEN_ADDRESS}`;

/** Standard ERC-20 selectors, verified working against this exact contract. */
const NAME_SELECTOR = '0x06fdde03';
const SYMBOL_SELECTOR = '0x95d89b41';

/** Real screenshot of the same token on testnet.arcscan.app (§7 manifest). */
const SCREENSHOT_SRC = '/media/attack-token-explorer.png';

interface TokenRead {
  name: string | null;
  symbol: string | null;
  error: string | null;
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }

  const json = (await res.json()) as { result?: string; error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? 'eth_call failed');
  }
  if (!json.result || json.result === '0x') {
    throw new Error('eth_call returned empty data');
  }
  return json.result;
}

/**
 * ABI-decode a dynamic string return value: [offset(32)][length(32)][data].
 * Adapted from packages/attack-corpus/harness/naive-agent-claude.ts.
 */
function decodeString(hexResult: string): string {
  const hex = hexResult.startsWith('0x') ? hexResult.slice(2) : hexResult;
  if (hex.length < 128) {
    throw new Error('return data too short to be an ABI string');
  }
  const length = parseInt(hex.slice(64, 128), 16);
  if (!Number.isFinite(length) || hex.length < 128 + length * 2) {
    throw new Error('malformed ABI string length');
  }
  return Buffer.from(hex.slice(128, 128 + length * 2), 'hex').toString('utf8');
}

async function readAttackToken(): Promise<TokenRead> {
  const rpcUrl = process.env.ARC_RPC_URL;
  if (!rpcUrl) {
    return { name: null, symbol: null, error: 'ARC_RPC_URL not set' };
  }

  try {
    const [nameHex, symbolHex] = await Promise.all([
      ethCall(rpcUrl, ATTACK_TOKEN_ADDRESS, NAME_SELECTOR),
      ethCall(rpcUrl, ATTACK_TOKEN_ADDRESS, SYMBOL_SELECTOR),
    ]);
    return { name: decodeString(nameHex), symbol: decodeString(symbolHex), error: null };
  } catch (err) {
    return { name: null, symbol: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The screenshots in §7's manifest are captured but not necessarily committed.
 * Check at request time so the image appears the moment the file lands, and a
 * broken <img> never ships in the meantime.
 */
function screenshotExists(): boolean {
  return existsSync(path.join(process.cwd(), 'public', 'media', 'attack-token-explorer.png'));
}

export async function ExplorerEvidenceStrip() {
  const token = await readAttackToken();
  const hasScreenshot = screenshotExists();

  return (
    <section className="max-w-content mx-auto px-8 py-16">
      <p className="text-small text-[#1E7BB8] font-bold uppercase tracking-wider">On-chain evidence</p>
      <h2 className="text-h1 text-[#10314A] mt-2">The payload is the token&apos;s name.</h2>

      <div className="bg-[#F2F8FD] border border-[#CFE3F2] mt-6">
        <div className="p-6 md:p-8">
          {token.error ? (
            <div className="border border-[#B4D3E9] bg-[#E7F1FA] p-4">
              <p className="text-small text-[#0B4F7D] font-bold">Live on-chain read failed: {token.error}</p>
              <p className="text-small text-[#52738D] mt-2">
                This panel only ever shows a value it just read from Arc testnet. It has no
                hardcoded copy to fall back on — check the explorer link below instead.
              </p>
            </div>
          ) : (
            <>
              <p className="text-small text-[#6E8CA5]">
                <span className="font-mono">name()</span> — read live from Arc testnet
              </p>
              <p className="text-body font-mono text-[#0B4F7D] font-bold mt-2 break-all">{token.name}</p>

              <p className="text-small text-[#6E8CA5] mt-6">
                <span className="font-mono">symbol()</span>
              </p>
              <p className="text-body font-mono text-[#10314A] mt-2">{token.symbol}</p>
            </>
          )}

          <div className="border-t border-[#CFE3F2] mt-6 pt-4">
            <p className="text-small text-[#6E8CA5]">Contract</p>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
              className="text-small font-mono text-[#1E7BB8] mt-2 inline-flex items-center gap-1.5 break-all hover:underline"
            >
              {ATTACK_TOKEN_ADDRESS}
              <ExternalLink size={13} strokeWidth={1.5} aria-hidden />
            </a>
          </div>

          {hasScreenshot && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={SCREENSHOT_SRC}
              alt={`testnet.arcscan.app showing the token at ${ATTACK_TOKEN_ADDRESS} with its injected name() string, as read by any third party`}
              className="border border-[#CFE3F2] mt-6 w-full"
            />
          )}

          <p className="text-small text-[#52738D] mt-6">
            Same data, no wallet, no trust in us: open it on testnet.arcscan.app and read the field
            yourself.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ExplorerEvidenceStrip;
