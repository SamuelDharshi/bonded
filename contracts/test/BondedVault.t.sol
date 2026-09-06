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

    address internal signer;
    address internal agent;

    MockUSDC       internal usdc;
    BondedRegistry internal registry;
    BondedVault    internal vault;

    bytes32 internal policyHash;

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        agent  = vm.addr(AGENT_PK);

        usdc     = new MockUSDC();
        registry = new BondedRegistry();
        vault    = new BondedVault(address(registry), signer, address(usdc));

        // Seed vault with 10 000 USDC
        usdc.mint(address(vault), 10_000 * 10 ** 6);

        // Agent commits a policy
        policyHash = keccak256("test-policy-v1");
        vm.prank(agent);
        registry.commitPolicy(policyHash);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _signVerdict(
        bytes32 proposalHash,
        bytes32 _policyHash,
        uint8   outcome,
        uint16  reasonCode,
        uint64  blockChecked,
        bytes32 logRef
    ) internal pure returns (bytes memory) {
        bytes32 msgHash = keccak256(
            abi.encodePacked(proposalHash, _policyHash, outcome, reasonCode, blockChecked, logRef)
        );
        bytes32 ethHash = msgHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _signStepUp(bytes32 proposalHash) internal pure returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked("STEPUP:", proposalHash));
        bytes32 ethHash = msgHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _transferAction(address target, uint256 value) internal pure returns (bytes memory) {
        return abi.encode(target, bytes(""), value);
    }

    function _settle(bytes32 proposalHash, uint8 outcome, uint16 reasonCode, uint256 valueUSDC, address recipient) internal {
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(recipient, valueUSDC);
        bytes memory sig     = _signVerdict(proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef);
        vm.prank(agent);
        vault.settle(proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef, action, sig);
    }

    // ─── Tests ────────────────────────────────────────────────────────────────

    function test_ClearedVerdictReleasesUSDC() public {
        address recipient    = makeAddr("recipient");
        uint256 value        = 50 * 10 ** 6; // 50 USDC
        bytes32 proposalHash = keccak256("proposal-1");

        uint256 balBefore = usdc.balanceOf(recipient);
        _settle(proposalHash, 0, 0, value, recipient);
        assertEq(usdc.balanceOf(recipient) - balBefore, value);
        assertTrue(vault.settled(proposalHash));
    }

    function test_RefusedVerdictHalts() public {
        address recipient    = makeAddr("recipient");
        bytes32 proposalHash = keccak256("proposal-refused");
        uint256 balBefore    = usdc.balanceOf(recipient);

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(recipient, 50 * 10 ** 6);
        bytes memory sig     = _signVerdict(proposalHash, policyHash, 1, 1, blockChecked, logRef);

        vm.prank(agent);
        vault.settle(proposalHash, policyHash, 1, 1, blockChecked, logRef, action, sig);

        assertEq(usdc.balanceOf(recipient), balBefore, "USDC moved on REFUSED");
        assertTrue(vault.settled(proposalHash));
    }

    function test_ReplaySameProposalReverts() public {
        bytes32 proposalHash = keccak256("proposal-replay");
        _settle(proposalHash, 0, 0, 10 * 10 ** 6, makeAddr("r"));

        vm.expectRevert(abi.encodeWithSelector(BondedVault.AlreadySettled.selector, proposalHash));
        _settle(proposalHash, 0, 0, 10 * 10 ** 6, makeAddr("r"));
    }

    function test_StalePolicyReverts() public {
        bytes32 wrongPolicy  = keccak256("old-policy");
        bytes32 proposalHash = keccak256("proposal-stale");
        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), 10 * 10 ** 6);
        bytes memory sig     = _signVerdict(proposalHash, wrongPolicy, 0, 0, blockChecked, logRef);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.PolicyMismatch.selector, wrongPolicy, policyHash));
        vault.settle(proposalHash, wrongPolicy, 0, 0, blockChecked, logRef, action, sig);
    }

    function test_IrreversibleRevertsWithoutStepUp() public {
        bytes32 proposalHash = keccak256("proposal-big");
        uint256 value        = 150 * 10 ** 6; // 150 USDC > 100 threshold

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), value);
        bytes memory sig     = _signVerdict(proposalHash, policyHash, 0, 0, blockChecked, logRef);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.IrreversibleNotConfirmed.selector, proposalHash));
        vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }

    function test_StepUpConfirmationAllowsExecution() public {
        bytes32 proposalHash = keccak256("proposal-stepup");
        uint256 value        = 150 * 10 ** 6;
        address recipient    = makeAddr("recipient-stepup");

        // 1. Submit HELD_FOR_STEPUP
        {
            uint64  blockChecked = uint64(block.number);
            bytes32 logRef       = keccak256("log");
            bytes memory action  = _transferAction(recipient, value);
            bytes memory sig     = _signVerdict(proposalHash, policyHash, 2, 6, blockChecked, logRef);
            vm.prank(agent);
            vault.settle(proposalHash, policyHash, 2, 6, blockChecked, logRef, action, sig);
        }
        assertTrue(vault.stepUpArmed(proposalHash));

        // 2. Confirm step-up
        vault.confirmStepUp(proposalHash, _signStepUp(proposalHash));
        assertTrue(vault.stepUpConfirmed(proposalHash));

        // 3. Settle CLEARED — should succeed
        uint256 balBefore = usdc.balanceOf(recipient);
        {
            uint64  blockChecked = uint64(block.number);
            bytes32 logRef       = keccak256("log");
            bytes memory action  = _transferAction(recipient, value);
            bytes memory sig     = _signVerdict(proposalHash, policyHash, 0, 0, blockChecked, logRef);
            vm.prank(agent);
            vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
        }
        assertEq(usdc.balanceOf(recipient) - balBefore, value);
    }

    function testFuzz_BudgetNeverExceeded(uint256[] calldata amounts) public {
        vm.assume(amounts.length > 0 && amounts.length <= 20);

        address recipient = makeAddr("fuzz-recipient");
        uint256 propIndex = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            // Bounded to IRREVERSIBLE_ABOVE, not BUDGET_MAX: this test isolates
            // the budget-accounting invariant on the routine (non-step-up) path.
            // The irreversible-threshold gate is a separate invariant, covered
            // by test_IrreversibleRevertsWithoutStepUp / test_StepUpConfirmationAllowsExecution.
            uint256 amt          = bound(amounts[i], 1, vault.IRREVERSIBLE_ABOVE());
            bytes32 proposalHash = keccak256(abi.encodePacked("fuzz", propIndex++));
            uint64  blockChecked = uint64(block.number);
            bytes32 logRef       = keccak256("log");
            bytes memory action  = _transferAction(recipient, amt);
            bytes memory sig     = _signVerdict(proposalHash, policyHash, 0, 0, blockChecked, logRef);

            bool willExceed = vault.spentThisPeriod(agent) + amt > vault.BUDGET_MAX();

            vm.prank(agent);
            if (willExceed) {
                vm.expectRevert();
                vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
            } else {
                vault.settle(proposalHash, policyHash, 0, 0, blockChecked, logRef, action, sig);
                assertLe(vault.spentThisPeriod(agent), vault.BUDGET_MAX());
            }
        }
    }

    function testFuzz_SettleCannotBeReplayed(bytes32 hash) public {
        vm.assume(hash != bytes32(0));

        uint64  blockChecked = uint64(block.number);
        bytes32 logRef       = keccak256("log");
        bytes memory action  = _transferAction(makeAddr("r"), 10 * 10 ** 6);
        bytes memory sig     = _signVerdict(hash, policyHash, 0, 0, blockChecked, logRef);

        vm.prank(agent);
        vault.settle(hash, policyHash, 0, 0, blockChecked, logRef, action, sig);

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.AlreadySettled.selector, hash));
        vault.settle(hash, policyHash, 0, 0, blockChecked, logRef, action, sig);
    }
}
