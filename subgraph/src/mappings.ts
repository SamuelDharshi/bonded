import {
  PolicyCommitted,
} from '../generated/BondedRegistry/BondedRegistry';
import {
  VerdictSettled,
  StepUpArmed,
  StepUpConfirmed,
  AgentAuthorized,
  AgentRevoked,
} from '../generated/BondedVault/BondedVault';
import { Policy, VerdictRecord, StepUpRecord, Agent } from '../generated/schema';

export function handlePolicyCommitted(event: PolicyCommitted): void {
  const id     = event.params.owner.toHexString();
  let entity   = Policy.load(id);
  if (!entity) {
    entity = new Policy(id);
  }
  entity.owner           = event.params.owner;
  entity.policyHash      = event.params.policyHash;
  entity.version         = event.params.version;
  entity.committedAt     = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleVerdictSettled(event: VerdictSettled): void {
  const id   = event.params.proposalHash.toHexString();
  let entity = VerdictRecord.load(id);
  if (!entity) {
    entity = new VerdictRecord(id);
  }
  entity.proposalHash      = event.params.proposalHash;
  entity.agent             = event.params.agent;
  entity.outcome           = event.params.outcome;
  entity.reasonCode        = event.params.reasonCode;
  entity.valueUSDC         = event.params.valueUSDC;
  entity.blockNumber       = event.block.number;
  entity.timestamp         = event.block.timestamp;
  entity.transactionHash   = event.transaction.hash;
  entity.save();
}

export function handleStepUpArmed(event: StepUpArmed): void {
  const id    = event.params.proposalHash.toHexString();
  let entity  = StepUpRecord.load(id);
  let isNew   = false;
  if (!entity) {
    entity = new StepUpRecord(id);
    isNew  = true;
  }
  // Only initialise `confirmed` when the record is new.
  //
  // A proposal can be armed more than once: HELD_FOR_STEPUP deliberately does
  // not mark it settled, so an agent that resubmits before confirmation arms it
  // again. Assigning false unconditionally here wiped a confirmation that had
  // already been recorded, and the contract never unsets stepUpConfirmed — so
  // the index claimed a hold was still awaiting a human when it was not, and an
  // owner following that would send a confirmStepUp that reverts.
  if (isNew) {
    entity.confirmed = false;
  }

  entity.proposalHash = event.params.proposalHash;
  entity.agent        = event.params.agent;
  entity.armedAt      = event.block.timestamp;
  entity.armedTxHash  = event.transaction.hash;
  entity.verdict      = id; // same ID as VerdictRecord, once one exists

  // Who has to confirm this. The event carries only the agent, so the owner is
  // read from the Agent entity — authorization always precedes settlement, so
  // it exists by the time a hold can be armed. Left null for holds armed on a
  // vault predating agent authorization, which is accurate rather than guessed.
  const agent = Agent.load(event.params.agent.toHexString());
  if (agent) {
    entity.owner = agent.owner;
  }

  entity.save();
}

export function handleAgentAuthorized(event: AgentAuthorized): void {
  const id     = event.params.agent.toHexString();
  let entity   = Agent.load(id);
  if (!entity) {
    entity = new Agent(id);
  }
  entity.agent           = event.params.agent;
  entity.owner           = event.params.owner;
  entity.revoked         = false;
  entity.authorizedAt    = event.block.timestamp;
  entity.revokedAt       = null;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleAgentRevoked(event: AgentRevoked): void {
  const id     = event.params.agent.toHexString();
  const entity = Agent.load(id);
  if (!entity) return;

  // Kept rather than removed: an owner should be able to see that an agent was
  // authorized and later revoked, not just that it is not authorized now.
  entity.revoked   = true;
  entity.revokedAt = event.block.timestamp;
  entity.save();
}

export function handleStepUpConfirmed(event: StepUpConfirmed): void {
  const id   = event.params.proposalHash.toHexString();
  const entity = StepUpRecord.load(id);
  if (!entity) return;
  entity.confirmedAt = event.block.timestamp;
  entity.confirmed   = true;
  entity.save();
}
