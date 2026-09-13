// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {BondedRegistry} from "../src/BondedRegistry.sol";
import {BondedVault}    from "../src/BondedVault.sol";

contract MockUSDCAB is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

/// Regression tests for a real vulnerability in an earlier revision.
///
/// The verdict digest used to be
///     keccak256(proposalHash, policyHash, outcome, reasonCode, blockChecked, logRef)
/// which does not include the action. A signed verdict therefore authorized a
/// *decision* but not a *payment*, and three things followed:
///
///   1. The action could be swapped for a different target and amount.
///   2. valueUSDC == 0 with calldata attached skipped the step-up guard (0 is
///      never above a threshold) and the budget check (adding 0), then reached
///      `target.call(calldata_)` — so the vault could be made to call
///      usdc.transfer(attacker, everything) while recording zero spend.
///   3. `commitPolicy` accepts an arbitrary bytes32, so an attacker mirrored
///      the victim policy hash and passed the registry check as themselves.
///
/// Measured against the vulnerable build: an enforcer authorization of 0.50
/// USDC yielded the attacker the vault's full 10,000 USDC and consumed no
/// budget. These tests now assert each route is closed.
contract ActionBindingTest is Test {
    using MessageHashUtils for bytes32;

    uint256 constant SIGNER_PK = 0xA11CE;
    uint256 constant AGENT_PK  = 0xB0B;

    bytes32 constant TYPEHASH = keccak256(
        "BondedVerdict(uint256 chainId,address vault,address agent,bytes32 proposalHash,bytes32 policyHash,uint8 outcome,uint16 reasonCode,uint64 blockChecked,bytes32 logRef,bytes32 actionHash)"
    );

    address signer;
    address agent;
    address owner;
    address attacker = makeAddr("attacker");
    address payee    = makeAddr("payee");

    MockUSDCAB     usdc;
    BondedRegistry registry;
    BondedVault    vault;
    bytes32        policyHash;

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        agent  = vm.addr(AGENT_PK);
        owner  = makeAddr("owner");

        usdc     = new MockUSDCAB();
        registry = new BondedRegistry();
        vault    = new BondedVault(address(registry), signer, address(usdc));

        usdc.mint(owner, 10_000 * 10 ** 6);
        vm.startPrank(owner);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(10_000 * 10 ** 6);
        vault.authorizeAgent(agent);
        vm.stopPrank();

        policyHash = keccak256("test-policy-v1");
        vm.prank(owner);
        registry.commitPolicy(policyHash);
    }

    function _sign(
        address settlingAgent,
        bytes32 ph,
        uint8   outcome,
        uint16  rc,
        uint64  blk,
        bytes32 logRef,
        bytes memory action
    ) internal view returns (bytes memory) {
        bytes32 d = keccak256(
            abi.encode(
                TYPEHASH, block.chainid, address(vault), settlingAgent,
                ph, policyHash, outcome, rc, blk, logRef, keccak256(action)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, d.toEthSignedMessageHash());
        return abi.encodePacked(r, s, v);
    }

    /// Route 1: substitute the action on a validly signed verdict.
    function test_actionSwapIsRejected() public {
        bytes32 ph = keccak256("proposal-1");
        uint64  blk = uint64(block.number);
        bytes32 logRef = keccak256("log");

        bytes memory authorised = abi.encode(payee, bytes(""), uint256(500_000));
        bytes memory sig = _sign(agent, ph, 0, 0, blk, logRef, authorised);

        // Same signature, 1000x the amount, different destination.
        bytes memory swapped = abi.encode(attacker, bytes(""), uint256(500_000_000));

        vm.prank(agent);
        vm.expectRevert(); // BadSigner — the action is inside the digest
        vault.settle(ph, policyHash, 0, 0, blk, logRef, swapped, sig);

        // Only what was signed can settle.
        vm.prank(agent);
        vault.settle(ph, policyHash, 0, 0, blk, logRef, authorised, sig);
        assertEq(usdc.balanceOf(payee), 500_000);
        assertEq(usdc.balanceOf(attacker), 0);
    }

    /// Route 2: the zero-value arbitrary-call drain.
    function test_zeroValueCalldataDrainIsRejected() public {
        bytes32 ph = keccak256("proposal-2");
        uint64  blk = uint64(block.number);
        bytes32 logRef = keccak256("log");
        uint256 held = usdc.balanceOf(address(vault));

        bytes memory drain = abi.encode(
            address(usdc),
            abi.encodeCall(ERC20.transfer, (attacker, held)),
            uint256(0)
        );

        // Even signed by the real enforcer, the vault refuses to make calls.
        bytes memory sig = _sign(agent, ph, 0, 0, blk, logRef, drain);

        vm.prank(agent);
        vm.expectRevert(BondedVault.CalldataNotAllowed.selector);
        vault.settle(ph, policyHash, 0, 0, blk, logRef, drain, sig);

        assertEq(usdc.balanceOf(attacker), 0);
        assertEq(usdc.balanceOf(address(vault)), held);
    }

    /// Route 3: mirror the victim policy hash and settle as yourself.
    function test_mirroringThePolicyHashDoesNotHelp() public {
        bytes32 ph = keccak256("proposal-3");
        uint64  blk = uint64(block.number);
        bytes32 logRef = keccak256("log");

        bytes memory authorised = abi.encode(payee, bytes(""), uint256(500_000));
        bytes memory sig = _sign(agent, ph, 0, 0, blk, logRef, authorised);

        // commitPolicy still accepts any bytes32, so the attacker can mirror it.
        vm.prank(attacker);
        registry.commitPolicy(policyHash);

        // It buys nothing: the attacker is not an authorized agent, and the
        // digest names `agent`, not them.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(BondedVault.AgentNotAuthorized.selector, attacker));
        vault.settle(ph, policyHash, 0, 0, blk, logRef, authorised, sig);

        // Authorizing themselves under their own account does not help either:
        // the verdict is bound to the other agent's address.
        address attackerAgent = makeAddr("attacker-agent");
        vm.prank(attacker);
        vault.authorizeAgent(attackerAgent);

        vm.prank(attackerAgent);
        vm.expectRevert(); // BadSigner — digest names a different agent
        vault.settle(ph, policyHash, 0, 0, blk, logRef, authorised, sig);

        assertEq(usdc.balanceOf(attacker), 0);
    }

    /// A verdict for one vault must not settle on another.
    function test_verdictIsNotReplayableOnAnotherVault() public {
        BondedVault other = new BondedVault(address(registry), signer, address(usdc));

        usdc.mint(owner, 100 * 10 ** 6);
        vm.startPrank(owner);
        usdc.approve(address(other), type(uint256).max);
        other.deposit(100 * 10 ** 6);
        other.authorizeAgent(agent);
        vm.stopPrank();

        bytes32 ph = keccak256("proposal-4");
        uint64  blk = uint64(block.number);
        bytes32 logRef = keccak256("log");
        bytes memory action = abi.encode(payee, bytes(""), uint256(500_000));

        // Signed against `vault`, whose address is inside the digest.
        bytes memory sig = _sign(agent, ph, 0, 0, blk, logRef, action);

        vm.prank(agent);
        vm.expectRevert();
        other.settle(ph, policyHash, 0, 0, blk, logRef, action, sig);
    }
}
