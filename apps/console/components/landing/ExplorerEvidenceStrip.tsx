import Image from 'next/image';
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

export async function ExplorerEvidenceStrip() {
  const token = await readAttackToken();

  return (
    <section className="relative w-full overflow-hidden">
      {/* Section backdrop. Purely decorative — aria-hidden, empty alt.

          media/on-chain.jpeg is a field of white flowers on black, so it takes
          the same conversion as the hero footage and the footer globe
          the #2E7FBF colour blend, inverted out of near-black into the white
          + light-blue theme rather than dropped in as a dark slab. It uses
          `.photo-art-light` rather than the `.glyph-art-light` the hero and
          footer use — see globals.css for why a photograph of large solid
          shapes needs different tuning from sparse glyph art, and why the
          opacity sits on a wrapper rather than on the image.

          Note this is a still, not an animation — the file is a JPEG despite
          being asked for as a gif, so nothing here moves. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#FFFFFF]"
      >
        <div className="absolute inset-0 opacity-[0.55]">
          <div className="absolute inset-0 isolate bg-[#FFFFFF]">
            <Image
              src="/media/on-chain.jpeg"
              alt=""
              fill
              sizes="100vw"
              /* Anchored low: the one tall flower sits at the top of the
                 source and landed squarely behind the heading. Cropping to
                 the bed of flowers below it gives an even texture with no
                 single shape competing with the type. */
              className="object-cover object-bottom photo-art-light"
            />
            <div className="absolute inset-0 bg-[#2E7FBF] mix-blend-color" />
          </div>
        </div>

        {/* Fades top and bottom so the section joins the white above and below
            it without hard seams. */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#FFFFFF] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#FFFFFF] to-transparent" />
      </div>

      <div className="relative z-10 max-w-content mx-auto px-8 py-16">
      <p className="text-small text-[#1E7BB8] font-bold uppercase tracking-wider">On-chain evidence</p>
      <h2 className="text-h1 text-[#10314A] mt-2">The payload is the token&apos;s name.</h2>

      {/* The card goes translucent so the backdrop reads through it, with a
          blur behind so the live name()/symbol() values stay crisp. Written as
          rgba() rather than a `/85` opacity suffix — Tailwind silently emits
          nothing for an opacity step it does not recognise. */}
      <div className="bg-[rgba(242,248,253,0.82)] backdrop-blur-md border border-[#CFE3F2] mt-6">
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

          <p className="text-small text-[#52738D] mt-6">
            Same data, no wallet, no trust in us: open it on testnet.arcscan.app and read the field
            yourself.
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}

export default ExplorerEvidenceStrip;
