// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {BondedRegistry} from "../src/BondedRegistry.sol";
import {BondedVault}    from "../src/BondedVault.sol";

// ─── Mock USDC ────────────────────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

contract BondedVaultTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 internal constant SIGNER_PK = 0xA11CE;
    uint256 internal constant AGENT_PK  = 0xB0B;

    /// Recomputed here from the literal string rather than read off the
    /// contract, so a change to the digest definition fails a test instead of
    /// silently agreeing with itself.
    bytes32 internal constant EXPECTED_TYPEHASH = keccak256(
        "BondedVerdict(uint256 chainId,address vault,address agent,bytes32 proposalHash,bytes32 policyHash,uint8 outcome,uint16 reasonCode,uint64 blockChecked,bytes32 logRef,bytes32 actionHash)"
    );

    address internal signer;
    address internal agent;
    address internal owner;

    MockUSDC       internal usdc;
    BondedRegistry internal registry;
    BondedVault    internal vault;

    bytes32 internal policyHash;

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        agent  = vm.addr(AGENT_PK);
        owner  = makeAddr("owner");

        usdc     = new MockUSDC();
        registry = new BondedRegistry();
        vault    = new BondedVault(address(registry), signer, address(usdc));

        // The owner funds the vault through deposit(), so the balance is
        // credited to them. A raw transfer would not be.
        usdc.mint(owner, 10_000 * 10 ** 6);
        vm.startPrank(owner);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000 * 10 ** 6);
        vault.authorizeAgent(agent);
        vm.stopPrank();

        // The policy belongs to the OWNER, not the agent.
        policyHash = keccak256("test-policy-v1");
        vm.prank(owner);
        registry.commitPolicy(policyHash);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _transferAction(address target, uint256 value) internal pure returns (bytes memory) {
        return abi.encode(target, bytes(""), value);
    }

    function _signVerdict(
        address settlingAgent,
        bytes32 proposalHash,
        bytes32 _policyHash,
        uint8   outcome,
        uint16  reasonCode,
        uint64  blockChecked,
        bytes32 logRef,
        bytes memory action
    ) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encode(
                EXPECTED_TYPEHASH,
                block.chainid,
                address(vault),
                settlingAgent,
                proposalHash,
                _policyHash,
                outcome,
                reasonCode,
                blockChecked,
                logRef,
                keccak256(action)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, digest.toEthSignedMessageHash());
        return abi.encodePacked(r, s, v);
    }

    function _settle(
        bytes32 proposalHash,
        uint8   outcome,
        uint16  reasonCode,
        uint256 valueUSDC,
        address recipient
    ) internal {
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(recipient, valueUSDC);
        bytes memory sig     =
            _signVerdict(agent, proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef, action);

        vm.prank(agent);
        vault.settle(proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef, action, sig);
    }

    // ─── Digest ───────────────────────────────────────────────────────────────

    function test_typehashAndDigestMatchAnIndependentComputation() public {
        assertEq(vault.VERDICT_TYPEHASH(), EXPECTED_TYPEHASH, "typehash drifted");

        bytes memory action = _transferAction(makeAddr("r"), 500_000);
        bytes32 expected = keccak256(
            abi.encode(
                EXPECTED_TYPEHASH, block.chainid, address(vault), agent,
                keccak256("p"), policyHash, uint8(0), uint16(0),
                uint64(block.number), keccak256("log"), keccak256(action)
            )
        );
        assertEq(
            vault.verdictDigest(
                agent, keccak256("p"), policyHash, 0, 0,
                uint64(block.number), keccak256("log"), keccak256(action)
            ),
            expected
        );
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    function test_ClearedVerdictReleasesUSDC() public {
        address recipient    = makeAddr("recipient");
        uint256 value        = 500_000; // 0.5 USDC, under the default threshold
        bytes32 proposalHash = keccak256("proposal-1");

        uint256 balBefore   = usdc.balanceOf(recipient);
        uint256 ownerBefore = vault.balanceOf(owner);

        _settle(proposalHash, 0, 0, value, recipient);

        assertEq(usdc.balanceOf(recipient) - balBefore, value);
        assertTrue(vault.settled(proposalHash));
        assertEq(vault.balanceOf(owner), ownerBefore - value, "debited from the owner");
        assertEq(vault.spentThisPeriod(owner), value, "budget tracked against the owner");
    }

    function test_RefusedVerdictHalts() public {
        address recipient    = makeAddr("recipient");
        bytes32 proposalHash = keccak256("proposal-refused");
        uint256 balBefore    = usdc.balanceOf(recipient);
        uint256 ownerBefore  = vault.balanceOf(owner);

        _settle(proposalHash, 1, 1, 50 * 10 ** 6, recipient);

        assertEq(usdc.balanceOf(recipient), balBefore, "USDC moved on REFUSED");
        assertEq(vault.balanceOf(owner), ownerBefore, "owner debited on REFUSED");
        assertTrue(vault.settled(proposalHash));
    }

    function test_ReplaySameProposalReverts() public {
        bytes32 proposalHash = keccak256("proposal-replay");
        _settle(proposalHash, 0, 0, 500_000, makeAddr("r"));

        vm.expectRevert(abi.encodeWithSelector(BondedVault.AlreadySettled.selector, proposalHash));
        _settle(proposalHash, 0, 0, 500_000, makeAddr("r"));
    }

    function test_StalePolicyReverts() public {
        bytes32 wrongPolicy  = keccak256("old-policy");
        bytes32 proposalHash = keccak256("proposal-stale");
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), 500_000);
        bytes memory sig     =
            _signVerdict(agent, proposalHash, wrongPolicy, 0, 0, blockChecked, logRef, action);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.PolicyMismatch.selector, wrongPolicy, policyHash));
        vault.settle(proposalHash, wrongPolicy, 0, 0, blockChecked, logRef, action, sig);
    }

    // ─── The action must be what the enforcer signed ──────────────────────────

    function test_actionCannotBeSwappedAfterSigning() public {
        bytes32 proposalHash = keccak256("proposal-swap");
        address payee        = makeAddr("payee");
        address thief        = makeAddr("thief");

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory signed  = _transferAction(payee, 500_000);
        bytes memory sig     =
            _signVerdict(agent, proposalHash, policyHash, 0, 0, blockChecked, logRef, signed);

        // Same signature, different destination.
        bytes memory swapped = _transferAction(thief, 500_000);

        vm.prank(agent);
        vm.expectRevert(); // BadSigner: the digest no longer matches
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, swapped, sig);

        // The authorised action still settles.
        vm.prank(agent);
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, signed, sig);
        assertEq(usdc.balanceOf(payee), 500_000);
        assertEq(usdc.balanceOf(thief), 0);
    }

    function test_calldataActionsAreRejected() public {
        bytes32 proposalHash = keccak256("proposal-calldata");
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");

        // A zero-value call: the shape that used to skip the step-up guard and
        // the budget check and then let the vault call anything.
        bytes memory action = abi.encode(
            address(usdc),
            abi.encodeCall(ERC20.transfer, (makeAddr("thief"), 10_000 * 10 ** 6)),
            uint256(0)
        );
        bytes memory sig =
            _signVerdict(agent, proposalHash, policyHash, 0, 0, blockChecked, logRef, action);

        vm.prank(agent);
        vm.expectRevert(BondedVault.CalldataNotAllowed.selector);
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    function test_verdictForOneAgentCannotBeSettledByAnother() public {
        address other = makeAddr("other-agent");
        vm.prank(owner);
        vault.authorizeAgent(other);

        bytes32 proposalHash = keccak256("proposal-agent-bound");
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), 500_000);

        // Signed for `agent`.
        bytes memory sig =
            _signVerdict(agent, proposalHash, policyHash, 0, 0, blockChecked, logRef, action);

        // `other` is a perfectly valid agent of the same owner, and still cannot
        // use a verdict addressed to a different agent.
        vm.prank(other);
        vm.expectRevert();
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    // ─── Step-up ──────────────────────────────────────────────────────────────

    function test_IrreversibleRevertsWithoutStepUp() public {
        bytes32 proposalHash = keccak256("proposal-big");
        uint256 value        = 2 * 10 ** 6; // 2 USDC, over the 1 USDC default

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), value);
        bytes memory sig     =
            _signVerdict(agent, proposalHash, policyHash, 0, 0, blockChecked, logRef, action);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.IrreversibleNotConfirmed.selector, proposalHash));
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    function test_StepUpConfirmationAllowsExecution() public {
        bytes32 proposalHash = keccak256("proposal-stepup");
        uint256 value        = 2 * 10 ** 6;
        address recipient    = makeAddr("recipient-stepup");

        _settle(proposalHash, 2, 6, value, recipient); // arm
        assertTrue(vault.stepUpArmed(proposalHash));
        assertEq(vault.stepUpOwner(proposalHash), owner, "hold assigned to the owner");
        assertFalse(vault.settled(proposalHash), "a hold must not settle the proposal");

        vm.prank(owner);
        vault.confirmStepUp(proposalHash);
        assertTrue(vault.stepUpConfirmed(proposalHash));

        uint256 balBefore = usdc.balanceOf(recipient);
        _settle(proposalHash, 0, 0, value, recipient); // execute
        assertEq(usdc.balanceOf(recipient) - balBefore, value);
    }

    function test_onlyOwnerCanConfirmStepUp() public {
        bytes32 proposalHash = keccak256("proposal-stepup-auth");
        _settle(proposalHash, 2, 6, 2 * 10 ** 6, makeAddr("r"));

        // Not the agent.
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.NotStepUpOwner.selector, agent, owner));
        vault.confirmStepUp(proposalHash);

        // Not the enforcer, which used to be the only thing that could.
        vm.prank(signer);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.NotStepUpOwner.selector, signer, owner));
        vault.confirmStepUp(proposalHash);

        // Not an unrelated address.
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.NotStepUpOwner.selector, stranger, owner));
        vault.confirmStepUp(proposalHash);

        vm.prank(owner);
        vault.confirmStepUp(proposalHash);
        assertTrue(vault.stepUpConfirmed(proposalHash));
    }

    function test_confirmedHoldReleasesOnlyTheConfirmedAction() public {
        bytes32 proposalHash = keccak256("proposal-stepup-bound");
        address intended     = makeAddr("intended");
        address elsewhere    = makeAddr("elsewhere");
        uint256 value        = 2 * 10 ** 6;

        _settle(proposalHash, 2, 6, value, intended);
        vm.prank(owner);
        vault.confirmStepUp(proposalHash);

        // A freshly signed verdict for a DIFFERENT action on the same confirmed
        // proposal must not ride on that confirmation.
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory other   = _transferAction(elsewhere, value);
        bytes memory sig     =
            _signVerdict(agent, proposalHash, policyHash, 0, 0, blockChecked, logRef, other);

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                BondedVault.StepUpActionMismatch.selector,
                keccak256(_transferAction(intended, value)),
                keccak256(other)
            )
        );
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, other, sig);

        // The confirmed action still goes through.
        _settle(proposalHash, 0, 0, value, intended);
        assertEq(usdc.balanceOf(intended), value);
        assertEq(usdc.balanceOf(elsewhere), 0);
    }

    // ─── Agent authorization ──────────────────────────────────────────────────

    function test_unauthorizedAgentCannotSettle() public {
        address rogue = makeAddr("rogue");
        bytes32 ph    = keccak256("proposal-rogue");

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(rogue, 500_000);
        bytes memory sig     =
            _signVerdict(rogue, ph, policyHash, 0, 0, blockChecked, logRef, action);

        vm.prank(rogue);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.AgentNotAuthorized.selector, rogue));
        vault.settle(ph, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    function test_revokedAgentCannotSettle() public {
        vm.prank(owner);
        vault.revokeAgent(agent);

        vm.expectRevert(abi.encodeWithSelector(BondedVault.AgentNotAuthorized.selector, agent));
        _settle(keccak256("proposal-revoked"), 0, 0, 500_000, makeAddr("r"));
    }

    function test_cannotHijackAnotherOwnersAgent() public {
        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.AgentOwnedByAnother.selector, agent, owner));
        vault.authorizeAgent(agent);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.AgentOwnedByAnother.selector, agent, owner));
        vault.revokeAgent(agent);
    }

    // ─── Per-owner fund isolation ─────────────────────────────────────────────

    function test_agentCannotSpendAnotherOwnersDeposit() public {
        // A second owner deposits, with their own agent and their own policy.
        address owner2 = makeAddr("owner2");
        address agent2 = makeAddr("agent2");
        usdc.mint(owner2, 100 * 10 ** 6);

        vm.startPrank(owner2);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(100 * 10 ** 6);
        vault.authorizeAgent(agent2);
        registry.commitPolicy(policyHash);
        vm.stopPrank();

        // owner2's agent tries to move more than owner2 deposited, even though
        // the vault physically holds far more.
        uint256 vaultHoldings = usdc.balanceOf(address(vault));
        assertGt(vaultHoldings, 100 * 10 ** 6, "vault holds more than owner2 put in");

        uint256 tooMuch      = 200 * 10 ** 6;
        bytes32 ph           = keccak256("proposal-cross-owner");
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(agent2, tooMuch);
        bytes memory sig     =
            _signVerdict(agent2, ph, policyHash, 0, 0, blockChecked, logRef, action);

        // Armed and confirmed by owner2, so only the balance check stands in
        // the way — and it must hold.
        bytes memory holdSig =
            _signVerdict(agent2, ph, policyHash, 2, 6, blockChecked, logRef, action);
        vm.prank(agent2);
        vault.settle(ph, policyHash, 2, 6, blockChecked, logRef, action, holdSig);
        vm.prank(owner2);
        vault.confirmStepUp(ph);

        vm.prank(agent2);
        vm.expectRevert(
            abi.encodeWithSelector(BondedVault.InsufficientBalance.selector, tooMuch, 100 * 10 ** 6)
        );
        vault.settle(ph, policyHash, 0, 0, blockChecked, logRef, action, sig);

        assertEq(vault.balanceOf(owner), 10_000 * 10 ** 6, "first owner untouched");
    }

    // ─── Deposits and withdrawals ─────────────────────────────────────────────

    function test_withdrawReturnsOwnFundsOnly() public {
        uint256 before = usdc.balanceOf(owner);

        vm.prank(owner);
        vault.withdraw(1_000 * 10 ** 6);

        assertEq(usdc.balanceOf(owner) - before, 1_000 * 10 ** 6);
        assertEq(vault.balanceOf(owner), 9_000 * 10 ** 6);
    }

    function test_withdrawCannotExceedOwnCredit() public {
        address stranger = makeAddr("stranger");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.InsufficientBalance.selector, 1, 0));
        vault.withdraw(1);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BondedVault.InsufficientBalance.selector, 10_001 * 10 ** 6, 10_000 * 10 ** 6
            )
        );
        vault.withdraw(10_001 * 10 ** 6);
    }

    function test_agentHasNoBalanceToWithdraw() public {
        // The agent is authorized to spend, which is not the same as being owed
        // anything. There is no path from an agent key to a withdrawal.
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.InsufficientBalance.selector, 1, 0));
        vault.withdraw(1);
    }

    function test_rawTransfersAreNotCredited() public {
        address donor = makeAddr("donor");
        usdc.mint(donor, 5 * 10 ** 6);

        vm.prank(donor);
        usdc.transfer(address(vault), 5 * 10 ** 6);

        assertEq(vault.balanceOf(donor), 0, "raw transfer must not credit");
        assertEq(vault.uncredited(), 5 * 10 ** 6, "and must be visible as uncredited");
    }

    // ─── Owner limits ─────────────────────────────────────────────────────────

    function test_ownerLimitsOverrideTheDefaults() public {
        (uint256 thr, uint256 budget) = vault.effectiveLimits(owner);
        assertEq(thr, vault.DEFAULT_IRREVERSIBLE_ABOVE());
        assertEq(budget, vault.DEFAULT_BUDGET_MAX());

        // Raise the threshold so what was a held amount becomes routine.
        vm.prank(owner);
        vault.setLimits(5 * 10 ** 6, 100 * 10 ** 6);

        (thr, budget) = vault.effectiveLimits(owner);
        assertEq(thr, 5 * 10 ** 6);
        assertEq(budget, 100 * 10 ** 6);

        address recipient = makeAddr("r-limits");
        _settle(keccak256("proposal-limits"), 0, 0, 2 * 10 ** 6, recipient);
        assertEq(usdc.balanceOf(recipient), 2 * 10 ** 6, "2 USDC is routine at a 5 USDC threshold");
    }

    function test_budgetCeilingIsEnforcedPerOwner() public {
        vm.prank(owner);
        vault.setLimits(10 * 10 ** 6, 3 * 10 ** 6); // budget 3 USDC

        address r = makeAddr("r-budget");
        _settle(keccak256("b1"), 0, 0, 2 * 10 ** 6, r);

        bytes32 ph           = keccak256("b2");
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(r, 2 * 10 ** 6);
        bytes memory sig     =
            _signVerdict(agent, ph, policyHash, 0, 0, blockChecked, logRef, action);

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(BondedVault.BudgetExceeded.selector, 2 * 10 ** 6, 1 * 10 ** 6)
        );
        vault.settle(ph, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_BudgetNeverExceeded(uint256[] calldata amounts) public {
        vm.assume(amounts.length > 0 && amounts.length <= 20);

        address recipient = makeAddr("fuzz-recipient");
        uint256 propIndex = 0;

        (uint256 threshold, uint256 budgetMax) = vault.effectiveLimits(owner);

        // Seed spentThisPeriod to just under the cap.
        //
        // The loop below is capped at the step-up threshold per settle to stay
        // on the routine path, and that is 1 USDC. Twenty 1-USDC settles come
        // nowhere near a 500 USDC budget, so without this the willExceed branch
        // is unreachable and the test silently stops checking the invariant it
        // exists for. Seeding goes through the step-up path precisely because a
        // single large routine settle is not possible.
        {
            uint256 seed     = budgetMax - 10 * 10 ** 6; // leave 10 USDC of room
            bytes32 seedHash = keccak256("fuzz-budget-seed");
            _settle(seedHash, 2, 6, seed, recipient);
            vm.prank(owner);
            vault.confirmStepUp(seedHash);
            _settle(seedHash, 0, 0, seed, recipient);
            assertEq(vault.spentThisPeriod(owner), seed);
        }

        for (uint256 i = 0; i < amounts.length; i++) {
            // Bounded to the threshold, not the budget: this test isolates the
            // budget-accounting invariant on the routine path. The threshold
            // gate is covered by test_IrreversibleRevertsWithoutStepUp and
            // test_StepUpConfirmationAllowsExecution.
            uint256 amt          = bound(amounts[i], 1, threshold);
            bytes32 proposalHash = keccak256(abi.encodePacked("fuzz", propIndex++));
            uint64  blockChecked = uint64(block.number);
            bytes32 logRef       = keccak256("log");
            bytes memory action  = _transferAction(recipient, amt);
            bytes memory sig     =
                _signVerdict(agent, proposalHash, policyHash, 0, 0, blockChecked, logRef, action);

            bool willExceed = vault.spentThisPeriod(owner) + amt > budgetMax;

            vm.prank(agent);
            if (willExceed) {
                vm.expectRevert();
                vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
            } else {
                vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
                assertLe(vault.spentThisPeriod(owner), budgetMax);
            }
        }
    }

    function testFuzz_SettleCannotBeReplayed(bytes32 hash) public {
        vm.assume(hash != bytes32(0));

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), 500_000);
        bytes memory sig     =
            _signVerdict(agent, hash, policyHash, 0, 0, blockChecked, logRef, action);

        vm.prank(agent);
        vault.settle(hash, policyHash, 0, 0, blockChecked, logRef, action, sig);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.AlreadySettled.selector, hash));
        vault.settle(hash, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    /// The vault must never owe more than it holds.
    function testFuzz_SolvencyInvariant(uint96 depositAmount, uint96 withdrawAmount) public {
        address o = makeAddr("solvency-owner");
        uint256 dep = bound(uint256(depositAmount), 1, 1_000_000 * 10 ** 6);
        usdc.mint(o, dep);

        vm.startPrank(o);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(dep);

        uint256 wd = bound(uint256(withdrawAmount), 0, dep);
        if (wd > 0) vault.withdraw(wd);
        vm.stopPrank();

        assertGe(
            usdc.balanceOf(address(vault)),
            vault.totalCredited(),
            "vault owes more than it holds"
        );
    }
}
