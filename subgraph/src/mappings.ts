import {
  PolicyCommitted,
} from '../generated/BondedRegistry/BondedRegistry';
import {
  VerdictSettled,
  StepUpArmed,
  StepUpConfirmed,
} from '../generated/BondedVault/BondedVault';
import { Policy, VerdictRecord, StepUpRecord } from '../generated/schema';

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
  const id   = event.params.proposalHash.toHexString();
  let entity = StepUpRecord.load(id);
  if (!entity) {
    entity = new StepUpRecord(id);
  }
  entity.proposalHash = event.params.proposalHash;
  entity.agent        = event.params.agent;
  entity.armedAt      = event.block.timestamp;
  entity.confirmed    = false;
  entity.verdict      = id; // same ID as VerdictRecord
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
