import { createHash } from 'crypto';
import type { Proposal, Policy, Address, Hash32 } from '@bonded/seam';
import { classify } from '@bonded/quarantine';
import { buildPrompt, type RawObservation } from './prompt.js';

export { RawObservation } from './prompt.js';

export interface ProposerConfig {
  agentAddress: Address;
  /** The ONLY network egress allowed from the proposer */
  modelEndpoint: string;
  modelApiKey: string;
  policy: Policy;
}

/**
 * Parse the model's JSON output into a typed Proposal.
 * Throws if the output cannot be parsed — never silently accepts malformed proposals.
 */
function parseModelOutput(raw: string, agent: Address): Omit<Proposal, 'id' | 'createdAt'> {
  let parsed: unknown;
  try {
    // Extract JSON block if model wraps it in markdown
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
    parsed = JSON.parse(jsonMatch[1] ?? raw);
  } catch {
    throw new Error(`Proposer: model output is not valid JSON:\n${raw.slice(0, 500)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Proposer: model output must be a JSON object');
  }

  const p = parsed as Record<string, unknown>;

  if (typeof p['action'] !== 'object' || p['action'] === null) {
    throw new Error('Proposer: missing action field');
  }
  const action = p['action'] as Record<string, unknown>;

  if (!Array.isArray(p['premises'])) {
    throw new Error('Proposer: premises must be an array');
  }

  return {
    agent,
    action: {
      kind:      String(action['kind']      ?? ''),
      target:    String(action['target']    ?? '0x0') as Address,
      calldata:  String(action['calldata']  ?? '0x') as `0x${string}`,
      valueUSDC: String(action['valueUSDC'] ?? '0'),
    },
    premises: (p['premises'] as unknown[]).map((prem) => {
      const pr = prem as Record<string, unknown>;
      return {
        premiseId:    String(pr['premiseId']    ?? ''),
        claimedValue: String(pr['claimedValue'] ?? '0'),
      };
    }),
  };
}

/**
 * Build a deterministic proposal ID from the proposal content.
 * keccak256 of canonical JSON (minus the id field itself).
 */
function buildProposalId(partial: Omit<Proposal, 'id'>): Hash32 {
  const content = JSON.stringify(partial, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v as unknown,
  );
  const hash = createHash('sha256').update(content, 'utf8').digest('hex');
  return `0x${hash}`;
}

/**
 * The proposer — Layer A of the Bonded architecture.
 *
 * INVARIANTS:
 * - No RPC access
 * - No signer
 * - Only network egress: modelEndpoint
 * - Quarantined observations are labelled in the prompt, never raw in instruction context
 * - Model output is parsed structurally — free text is never executed
 * - This is the LEAST interesting part of the system. The enforcer is the product.
 */
export async function propose(
  task: string,
  observations: RawObservation[],
  config: ProposerConfig,
): Promise<Proposal> {
  // Separate trusted from quarantined observations
  const trusted     = observations.filter((o) => classify(o.source) !== 'QUARANTINED');
  const quarantined = observations.filter((o) => classify(o.source) === 'QUARANTINED');

  const prompt = buildPrompt(task, trusted, quarantined, config.policy);

  // Call model — ONLY network egress allowed from this package
  const response = await fetch(config.modelEndpoint, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.modelApiKey}`,
    },
    body: JSON.stringify({
      model:    'gpt-4o-mini', // Cheapest capable model — deliberately uninteresting
      messages: [
        {
          role:    'system',
          content: 'You are a transaction proposer. Output a JSON proposal object only. No prose.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens:  1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Model endpoint error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const raw = json.choices[0]?.message.content ?? '';
  const now = Math.floor(Date.now() / 1000);

  const partial = parseModelOutput(raw, config.agentAddress);
  const partial2: Omit<Proposal, 'id'> = { ...partial, createdAt: now };
  const id = buildProposalId(partial2);

  return { id, ...partial2 };
}
