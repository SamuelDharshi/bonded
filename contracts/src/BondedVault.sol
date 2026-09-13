// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IBondedRegistry {
    function currentPolicyHash(address owner) external view returns (bytes32);
}

/// @title BondedVault
/// @notice Holds USDC for many owners and releases it only against a verdict
///         countersigned by the enrolled enforcer. Enforces per-owner rolling
///         budgets, per-owner step-up confirmation, and hard anti-replay.
///
/// ROLES
///
///   owner  A human wallet. Deposits, withdraws its own balance, authorizes
///          agents, sets its own limits, and confirms step-up holds. The policy
///          hash it committed to the registry is what every settlement against
///          its funds is checked against. Never held by the service.
///
///   agent  A bot key. Submits proposals and calls settle(). Holds no funds and
///          can be revoked at any time. Authorizing an agent means naming an
///          address: no credential is ever handed over.
///
///   enrolledSigner  The verdict-signing key. It can authorize a release but
///          cannot choose the destination or the amount, because the action is
///          inside the digest it signs. It can only countersign the exact
///          transfer it evaluated.
///
/// WHAT THE SIGNATURE COVERS
///
/// The digest binds the chain, this vault, the settling agent, the verdict and
/// keccak256(action). An earlier revision omitted the action, so a signed
/// verdict authorized a decision but not a payment: the signature could be
/// reused with a different target and amount, and a zero-value action with
/// calldata attached bypassed both the step-up guard and the budget check.
/// test/ActionBinding.t.sol pins that behaviour shut.
///
/// Ordering is checks, then effects, then the one interaction. Arbitrary
/// calldata is rejected: a policy cannot reason about the effects of a call it
/// has not modelled, and a zero-value call would consume no budget.
contract BondedVault is ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant PERIOD_DURATION = 7 days;

    /// Applied to any owner that has not called setLimits.
    uint256 public constant DEFAULT_IRREVERSIBLE_ABOVE = 1_000_000;   // 1 USDC
    uint256 public constant DEFAULT_BUDGET_MAX         = 500_000_000; // 500 USDC

    uint8 private constant OUTCOME_CLEARED     = 0;
    uint8 private constant OUTCOME_REFUSED     = 1;
    uint8 private constant OUTCOME_HELD_STEPUP = 2;

    /// Domain tag for the verdict digest. Changing any field below changes this
    /// string, which invalidates every previously issued signature by design.
    bytes32 public constant VERDICT_TYPEHASH = keccak256(
        "BondedVerdict(uint256 chainId,address vault,address agent,bytes32 proposalHash,bytes32 policyHash,uint8 outcome,uint16 reasonCode,uint64 blockChecked,bytes32 logRef,bytes32 actionHash)"
    );

    // ─── Immutables ───────────────────────────────────────────────────────────

    IBondedRegistry public immutable registry;
    address         public immutable enrolledSigner;
    IERC20          public immutable usdc;

    // ─── Types ────────────────────────────────────────────────────────────────

    struct Limits {
        uint256 irreversibleAbove;
        uint256 budgetMax;
        bool    set;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// Credited deposits per owner. The sum is what the vault owes.
    mapping(address => uint256) public balanceOf;

    /// Total credited across all owners. USDC above this arrived by raw
    /// transfer and is deliberately unclaimable rather than sweepable.
    uint256 public totalCredited;

    /// agent => owner. Zero means the agent is not authorized.
    mapping(address => address) public ownerOf;

    mapping(address => Limits)  public limitsOf;
    mapping(address => uint256) public spentThisPeriod;
    mapping(address => uint256) public periodStart;

    mapping(bytes32 => bool)    public settled;
    mapping(bytes32 => bool)    public stepUpArmed;
    mapping(bytes32 => bool)    public stepUpConfirmed;

    /// Who must confirm a hold, and the exact action they are confirming.
    mapping(bytes32 => address) public stepUpOwner;
    mapping(bytes32 => bytes32) public stepUpActionHash;

    // ─── Events ───────────────────────────────────────────────────────────────
    // The three original events keep their exact signatures so the deployed
    // subgraph keeps indexing without a manifest migration.

    event VerdictSettled(
        bytes32 indexed proposalHash,
        address indexed agent,
        uint8   outcome,
        uint16  reasonCode,
        uint256 valueUSDC
    );
    event StepUpArmed(bytes32 indexed proposalHash, address indexed agent);
    event StepUpConfirmed(bytes32 indexed proposalHash);

    event Deposited(address indexed owner, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed owner, uint256 amount, uint256 newBalance);
    event AgentAuthorized(address indexed owner, address indexed agent);
    event AgentRevoked(address indexed owner, address indexed agent);
    event LimitsSet(address indexed owner, uint256 irreversibleAbove, uint256 budgetMax);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error AlreadySettled(bytes32 proposalHash);
    error BadSigner(address recovered, address expected);
    error PolicyMismatch(bytes32 provided, bytes32 onChain);
    error BudgetExceeded(uint256 requested, uint256 remaining);
    error IrreversibleNotConfirmed(bytes32 proposalHash);
    error StepUpNotArmed(bytes32 proposalHash);
    error AlreadyStepUpConfirmed(bytes32 proposalHash);
    error InvalidOutcome(uint8 outcome);
    error AgentNotAuthorized(address agent);
    error AgentOwnedByAnother(address agent, address owner);
    error InsufficientBalance(uint256 requested, uint256 available);
    error CalldataNotAllowed();
    error ZeroValue();
    error ZeroAddress();
    error NotStepUpOwner(address caller, address expected);
    error StepUpActionMismatch(bytes32 armed, bytes32 provided);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address registry_, address enrolledSigner_, address usdc_) {
        if (registry_ == address(0) || enrolledSigner_ == address(0) || usdc_ == address(0)) {
            revert ZeroAddress();
        }
        registry       = IBondedRegistry(registry_);
        enrolledSigner = enrolledSigner_;
        usdc           = IERC20(usdc_);
    }

    // ─── Owner: funds ─────────────────────────────────────────────────────────

    /// @notice Deposit USDC and have it credited to the caller.
    /// @dev Needs an ERC20 approval to this contract first. Raw transfers into
    ///      the vault are NOT credited, and there is no sweep, because a sweep
    ///      is an escape hatch around the enforcer.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroValue();

        // Credit what actually arrived, so a fee-on-transfer token can never
        // credit more than the vault received.
        uint256 before   = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - before;

        balanceOf[msg.sender] += received;
        totalCredited        += received;

        emit Deposited(msg.sender, received, balanceOf[msg.sender]);
    }

    /// @notice Withdraw your own credited balance back to your own address.
    /// @dev Not an escape hatch around the enforcer: it returns a depositor's
    ///      own funds to the depositor. An agent key cannot reach it, because
    ///      agents are never credited a balance.
    function withdraw(uint256 amount) external nonReentrant {
        uint256 available = balanceOf[msg.sender];
        if (amount == 0)         revert ZeroValue();
        if (amount > available)  revert InsufficientBalance(amount, available);

        balanceOf[msg.sender] = available - amount;
        totalCredited        -= amount;

        emit Withdrawn(msg.sender, amount, balanceOf[msg.sender]);

        usdc.safeTransfer(msg.sender, amount);
    }

    // ─── Owner: agents and limits ─────────────────────────────────────────────

    /// @notice Authorize an agent address to spend against your policy.
    /// @dev Naming an address, not surrendering a key. The agent key never
    ///      leaves wherever the agent runs.
    function authorizeAgent(address agent) external {
        if (agent == address(0)) revert ZeroAddress();

        address existing = ownerOf[agent];
        if (existing != address(0) && existing != msg.sender) {
            revert AgentOwnedByAnother(agent, existing);
        }

        ownerOf[agent] = msg.sender;
        emit AgentAuthorized(msg.sender, agent);
    }

    function revokeAgent(address agent) external {
        address existing = ownerOf[agent];
        if (existing != msg.sender) revert AgentOwnedByAnother(agent, existing);

        delete ownerOf[agent];
        emit AgentRevoked(msg.sender, agent);
    }

    /// @notice Set your own step-up threshold and rolling budget ceiling.
    /// @dev Your money, your thresholds. These should agree with the committed
    ///      policy artifact; the console surfaces any disagreement.
    function setLimits(uint256 irreversibleAbove, uint256 budgetMax) external {
        limitsOf[msg.sender] = Limits(irreversibleAbove, budgetMax, true);
        emit LimitsSet(msg.sender, irreversibleAbove, budgetMax);
    }

    function effectiveLimits(address owner)
        public
        view
        returns (uint256 irreversibleAbove, uint256 budgetMax)
    {
        Limits memory l = limitsOf[owner];
        if (l.set) return (l.irreversibleAbove, l.budgetMax);
        return (DEFAULT_IRREVERSIBLE_ABOVE, DEFAULT_BUDGET_MAX);
    }

    /// @notice USDC in the vault that no owner is credited for.
    function uncredited() external view returns (uint256) {
        return usdc.balanceOf(address(this)) - totalCredited;
    }

    // ─── Verdict digest ───────────────────────────────────────────────────────

    /// @notice The exact digest the enforcer must sign, action included.
    function verdictDigest(
        address agent,
        bytes32 proposalHash,
        bytes32 policyHash,
        uint8   outcome,
        uint16  reasonCode,
        uint64  blockChecked,
        bytes32 logRef,
        bytes32 actionHash
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                VERDICT_TYPEHASH,
                block.chainid,
                address(this),
                agent,
                proposalHash,
                policyHash,
                outcome,
                reasonCode,
                blockChecked,
                logRef,
                actionHash
            )
        );
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    /// @notice Settle a verdict countersigned by the enrolled enforcer.
    /// @param action      abi.encode(address target, bytes calldata_, uint256 valueUSDC).
    ///                    calldata_ MUST be empty; the tuple shape is kept so
    ///                    existing callers and the decision record do not change.
    /// @param enforcerSig EIP-191 ECDSA signature by enrolledSigner over
    ///                    verdictDigest(...), which includes keccak256(action).
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
        if (settled[proposalHash]) revert AlreadySettled(proposalHash);

        // The agent must be authorized, and the policy checked is its owner's.
        address owner = ownerOf[msg.sender];
        if (owner == address(0)) revert AgentNotAuthorized(msg.sender);

        // Verify the signature over a digest binding the chain, this vault,
        // this agent, the verdict, and the action itself.
        {
            bytes32 digest = verdictDigest(
                msg.sender, proposalHash, policyHash, outcome,
                reasonCode, blockChecked, logRef, keccak256(action)
            );
            address recovered = digest.toEthSignedMessageHash().recover(enforcerSig);
            if (recovered != enrolledSigner) revert BadSigner(recovered, enrolledSigner);
        }

        bytes32 onChainPolicy = registry.currentPolicyHash(owner);
        if (policyHash != onChainPolicy) revert PolicyMismatch(policyHash, onChainPolicy);

        if (outcome == OUTCOME_CLEARED) {
            (address target, bytes memory calldata_, uint256 valueUSDC) =
                abi.decode(action, (address, bytes, uint256));

            if (calldata_.length != 0) revert CalldataNotAllowed();
            if (valueUSDC == 0)        revert ZeroValue();
            if (target == address(0))  revert ZeroAddress();

            (uint256 irreversibleAbove, uint256 budgetMax) = effectiveLimits(owner);

            // Above the owner's threshold the owner must have confirmed THIS
            // action, not merely this proposal id.
            if (valueUSDC > irreversibleAbove) {
                if (!stepUpConfirmed[proposalHash]) revert IrreversibleNotConfirmed(proposalHash);

                bytes32 armedAction = stepUpActionHash[proposalHash];
                bytes32 thisAction  = keccak256(action);
                if (armedAction != thisAction) revert StepUpActionMismatch(armedAction, thisAction);
            }

            // Rolling budget window, per owner.
            uint256 spent = spentThisPeriod[owner];
            if (block.timestamp >= periodStart[owner] + PERIOD_DURATION) {
                periodStart[owner] = block.timestamp;
                spent              = 0;
            }
            if (spent + valueUSDC > budgetMax) {
                revert BudgetExceeded(valueUSDC, budgetMax > spent ? budgetMax - spent : 0);
            }

            // An agent can only ever spend its own owner's deposits.
            uint256 available = balanceOf[owner];
            if (valueUSDC > available) revert InsufficientBalance(valueUSDC, available);

            // Effects before the interaction.
            settled[proposalHash]  = true;
            balanceOf[owner]       = available - valueUSDC;
            totalCredited         -= valueUSDC;
            spentThisPeriod[owner] = spent + valueUSDC;

            usdc.safeTransfer(target, valueUSDC);

            emit VerdictSettled(proposalHash, msg.sender, outcome, reasonCode, valueUSDC);

        } else if (outcome == OUTCOME_REFUSED) {
            settled[proposalHash] = true;
            emit VerdictSettled(proposalHash, msg.sender, outcome, reasonCode, 0);

        } else if (outcome == OUTCOME_HELD_STEPUP) {
            // Deliberately NOT marked settled: the proposal is resubmitted once
            // the owner confirms. Record who must confirm, and exactly what.
            stepUpArmed[proposalHash]      = true;
            stepUpOwner[proposalHash]      = owner;
            stepUpActionHash[proposalHash] = keccak256(action);

            emit StepUpArmed(proposalHash, msg.sender);

        } else {
            revert InvalidOutcome(outcome);
        }
    }

    /// @notice Confirm a held proposal. Only the owner whose funds are at stake
    ///         can call this, from their own wallet.
    /// @dev This previously verified a signature from enrolledSigner, which made
    ///      the enforcer the confirmer of its own holds: a human gate in name
    ///      only. A direct call from the owner is the gate.
    function confirmStepUp(bytes32 proposalHash) external {
        if (!stepUpArmed[proposalHash])    revert StepUpNotArmed(proposalHash);
        if (stepUpConfirmed[proposalHash]) revert AlreadyStepUpConfirmed(proposalHash);

        address owner = stepUpOwner[proposalHash];
        if (msg.sender != owner) revert NotStepUpOwner(msg.sender, owner);

        stepUpConfirmed[proposalHash] = true;
        emit StepUpConfirmed(proposalHash);
    }
}
