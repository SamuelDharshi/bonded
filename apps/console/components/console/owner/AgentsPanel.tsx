'use client';

import { useState } from 'react';
import { VAULT_ABI } from '@bonded/seam';
import { walletClient } from '../../../lib/bonded/wallet';
import { Addr, Button, Input, Panel, TxLink } from './primitives';
import { useOwner, type OwnerState } from './OwnerProvider';

/**
 * Which agents may spend, and revoking the ones that may not.
 *
 * The thing worth being loud about: authorizing is naming an address. No key
 * changes hands, here or anywhere else in the product — the agent proves each
 * proposal by signing it with the key it already holds. People expect to paste a
 * secret somewhere, so the page says plainly that there is nowhere to paste one.
 */
export function AgentsPanel({
  state,
  account,
  compact = false,
}: {
  state: OwnerState;
  account: `0x${string}`;
  compact?: boolean;
}) {
  const { send, busy, setMessage } = useOwner();
  const [addr, setAddr] = useState('');
  const disabled = busy !== null;

  const live = state.agents.filter((a) => a.authorized);
  const revoked = state.agents.filter((a) => !a.authorized);
  const valid = /^0x[0-9a-fA-F]{40}$/.test(addr.trim());

  function authorize() {
    const candidate = addr.trim() as `0x${string}`;
    if (candidate.toLowerCase() === account.toLowerCase()) {
      // Allowed by the contract, and how the CLI demo runs — but a real setup
      // should keep the two keys apart, so say why rather than blocking it.
      setMessage({
        kind: 'pending',
        text: 'That is your own address. It works, but it puts the key that can withdraw and the key a bot signs with in the same place — prefer a separate agent key.',
      });
    }
    void send('Authorization', () =>
      walletClient(account).writeContract({
        address: state.vault,
        abi: VAULT_ABI,
        functionName: 'authorizeAgent',
        args: [candidate],
        chain: null,
        account,
      }),
    ).then((ok) => {
      if (ok) setAddr('');
    });
  }

  return (
    <Panel
      title={compact ? 'Authorize your agent' : 'Agents'}
      note="Authorizing an agent means naming its address. You never hand over its key, and nothing in this product ever asks for one — the agent proves each proposal by signing it with the key it already has. Revoking takes effect immediately for anything not already settled."
    >
      {live.length === 0 ? (
        <p className="text-small text-manifest/50">
          No agents authorized. Until one is, every proposal is refused with 403 — the correct
          answer, not a fault to work around.
        </p>
      ) : (
        <div className="space-y-2">
          {live.map((a) => (
            <div
              key={a.agent}
              className="flex flex-wrap items-baseline justify-between gap-3 py-2 border-b border-hairline/50 last:border-0"
            >
              <div className="text-small">
                <Addr value={a.agent} />
                <span className="ml-3 font-mono text-seal">authorized</span>
                {!a.agreesWithChain && (
                  <span
                    className="ml-3 font-mono text-hold"
                    title="the index and the vault disagree; the vault is authoritative"
                  >
                    index catching up
                  </span>
                )}
                {a.transactionHash && (
                  <span className="ml-3 text-manifest/40">
                    <TxLink hash={a.transactionHash}>authorized in</TxLink>
                  </span>
                )}
              </div>
              <Button
                tone="danger"
                disabled={disabled}
                onClick={() =>
                  void send('Revocation', () =>
                    walletClient(account).writeContract({
                      address: state.vault,
                      abi: VAULT_ABI,
                      functionName: 'revokeAgent',
                      args: [a.agent as `0x${string}`],
                      chain: null,
                      account,
                    }),
                  )
                }
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[18rem]">
          <Input
            label="authorize an agent"
            value={addr}
            onChange={setAddr}
            placeholder="0x…"
            hint="The public address your bot signs with. Never its private key."
          />
        </div>
        <Button tone="primary" disabled={disabled || !valid} onClick={authorize}>
          Authorize
        </Button>
      </div>

      {!compact && revoked.length > 0 && (
        <div className="mt-6 pt-4 border-t border-hairline">
          <p className="text-small text-manifest/50 mb-2">
            Previously authorized. Kept visible on purpose — that an agent once had access is part of
            the record, not noise to hide.
          </p>
          {revoked.map((a) => (
            <div key={a.agent} className="text-small py-1">
              <Addr value={a.agent} />
              <span className="ml-3 font-mono text-manifest/40">revoked</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default AgentsPanel;
