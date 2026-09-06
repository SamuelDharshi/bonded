// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBondedRegistry {
    function currentPolicyHash(address owner) external view returns (bytes32);
}

/// @title BondedVault
/// @notice Executes agent-initiated on-chain actions only after an off-chain
///         enforcer (running inside a Chainlink CRE TEE) has cryptographically
///         countersigned the verdict. Enforces rolling spend budgets, step-up
///         for irreversible large transfers, and hard anti-replay.
///
/// Settlement order (MUST NOT be reordered):
///   mark → check → call → settle → emit
contract BondedVault is ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant PERIOD_DURATION  = 7 days;
    uint256 public constant IRREVERSIBLE_ABOVE = 100_000_000; // 100 USDC (6 decimals)
    uint256 public constant BUDGET_MAX       = 500_000_000;  // 500 USDC (6 decimals)

    uint8 private constant OUTCOME_CLEARED    = 0;
    uint8 private constant OUTCOME_REFUSED    = 1;
    uint8 private constant OUTCOME_HELD_STEPUP = 2;

    // ─── Immutables ───────────────────────────────────────────────────────────

    IBondedRegistry public immutable registry;
    address         public immutable enrolledSigner;
    IERC20          public immutable usdc;

    // ─── State ────────────────────────────────────────────────────────────────

    mapping(bytes32 => bool)    public settled;
    mapping(address => uint256) public spentThisPeriod;
    mapping(address => uint256) public periodStart;
    mapping(bytes32 => bool)    public stepUpArmed;
    mapping(bytes32 => bool)    public stepUpConfirmed;

    // ─── Events ───────────────────────────────────────────────────────────────

    event VerdictSettled(
        bytes32 indexed proposalHash,
        address indexed agent,
        uint8   outcome,
        uint16  reasonCode,
        uint256 valueUSDC
    );
    event StepUpArmed(bytes32 indexed proposalHash, address indexed agent);
    event StepUpConfirmed(bytes32 indexed proposalHash);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error AlreadySettled(bytes32 proposalHash);
    error BadSigner(address recovered, address expected);
    error PolicyMismatch(bytes32 provided, bytes32 onChain);
    error BudgetExceeded(uint256 requested, uint256 remaining);
    error IrreversibleNotConfirmed(bytes32 proposalHash);
    error StepUpNotArmed(bytes32 proposalHash);
    error AlreadyStepUpConfirmed(bytes32 proposalHash);
    error InvalidOutcome(uint8 outcome);
    error TransferFailed();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address registry_, address enrolledSigner_, address usdc_) {
        require(registry_       != address(0), "BondedVault: zero registry");
        require(enrolledSigner_ != address(0), "BondedVault: zero signer");
        require(usdc_           != address(0), "BondedVault: zero usdc");

        registry       = IBondedRegistry(registry_);
        enrolledSigner = enrolledSigner_;
        usdc           = IERC20(usdc_);
    }

    // ─── Primary Settlement Function ──────────────────────────────────────────

    /// @notice Settle a verdict countersigned by the enrolled enforcer.
    /// @param proposalHash  keccak256 of the canonical proposal JSON
    /// @param policyHash    keccak256 of the policy artifact evaluated against
    /// @param outcome       0=CLEARED, 1=REFUSED, 2=HELD_FOR_STEPUP
    /// @param reasonCode    Enumerated reason code (seam ReasonCode)
    /// @param blockChecked  Block at which all premises were re-derived
    /// @param logRef        Content hash of the full decision record
    /// @param action        abi.encode(address target, bytes calldata_, uint256 valueUSDC)
    /// @param enforcerSig   ECDSA signature by enrolledSigner
    function settle(
        bytes32 proposalHash,
        bytes32 policyHash,
        uint8   outcome,
        uint16  reasonCode,
        uint64  blockChecked,
        bytes32 logRef,
        bytes calldata action,
        bytes calldata enforcerSig
    ) external nonReentrant {
        // ── MARK: anti-replay guard ───────────────────────────────────────────
        if (settled[proposalHash]) revert AlreadySettled(proposalHash);

        // ── CHECK: verify enforcer signature ─────────────────────────────────
        {
            bytes32 msgHash = keccak256(
                abi.encodePacked(proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef)
            );
            address recovered = msgHash.toEthSignedMessageHash().recover(enforcerSig);
            if (recovered != enrolledSigner) revert BadSigner(recovered, enrolledSigner);
        }

        // ── CHECK: verify on-chain policy commitment ──────────────────────────
        bytes32 onChainPolicy = registry.currentPolicyHash(msg.sender);
        if (policyHash != onChainPolicy) revert PolicyMismatch(policyHash, onChainPolicy);

        // ── BRANCH on outcome ─────────────────────────────────────────────────
        if (outcome == OUTCOME_CLEARED) {
            (address target, bytes memory calldata_, uint256 valueUSDC) =
                abi.decode(action, (address, bytes, uint256));

            // Step-up guard for irreversible amounts
            if (valueUSDC > IRREVERSIBLE_ABOVE) {
                if (!stepUpConfirmed[proposalHash]) {
                    revert IrreversibleNotConfirmed(proposalHash);
                }
            }

            // Rolling budget reset
            if (block.timestamp >= periodStart[msg.sender] + PERIOD_DURATION) {
                periodStart[msg.sender]     = block.timestamp;
                spentThisPeriod[msg.sender] = 0;
            }

            // Budget ceiling check — before external call
            uint256 spent = spentThisPeriod[msg.sender];
            if (spent + valueUSDC > BUDGET_MAX) {
                revert BudgetExceeded(valueUSDC, BUDGET_MAX - spent);
            }

            // ── MARK settled (before external call) ───────────────────────────
            settled[proposalHash] = true;

            // ── CALL external action ──────────────────────────────────────────
            if (valueUSDC > 0 && calldata_.length == 0) {
                bool ok = usdc.transfer(target, valueUSDC);
                if (!ok) revert TransferFailed();
            } else if (calldata_.length > 0) {
                (bool success,) = target.call(calldata_);
                require(success, "BondedVault: call failed");
            }

            // ── SETTLE: update accounting AFTER external call ─────────────────
            spentThisPeriod[msg.sender] = spent + valueUSDC;

            // ── EMIT ──────────────────────────────────────────────────────────
            emit VerdictSettled(proposalHash, msg.sender, outcome, reasonCode, valueUSDC);

        } else if (outcome == OUTCOME_REFUSED) {
            settled[proposalHash] = true;
            emit VerdictSettled(proposalHash, msg.sender, outcome, reasonCode, 0);

        } else if (outcome == OUTCOME_HELD_STEPUP) {
            // Do NOT mark settled — allow re-submission after step-up confirmation
            stepUpArmed[proposalHash] = true;
            emit StepUpArmed(proposalHash, msg.sender);

        } else {
            revert InvalidOutcome(outcome);
        }
    }

    // ─── Step-Up Confirmation ─────────────────────────────────────────────────

    /// @notice Called after the Chainlink CRE TEE issues step-up confirmation.
    function confirmStepUp(bytes32 proposalHash, bytes calldata deviceSig) external {
        if (!stepUpArmed[proposalHash])    revert StepUpNotArmed(proposalHash);
        if (stepUpConfirmed[proposalHash]) revert AlreadyStepUpConfirmed(proposalHash);

        bytes32 msgHash  = keccak256(abi.encodePacked("STEPUP:", proposalHash));
        address recovered = msgHash.toEthSignedMessageHash().recover(deviceSig);
        if (recovered != enrolledSigner) revert BadSigner(recovered, enrolledSigner);

        stepUpConfirmed[proposalHash] = true;
        emit StepUpConfirmed(proposalHash);
    }
}
