// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BondedRegistry} from "../src/BondedRegistry.sol";

contract BondedRegistryTest is Test {
    BondedRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal other = makeAddr("other");

    function setUp() public {
        registry = new BondedRegistry();
    }

    function test_CommitPolicySetsHashAndVersion() public {
        vm.prank(owner);
        registry.commitPolicy(bytes32("policy-v1"));

        assertEq(registry.currentPolicyHash(owner), bytes32("policy-v1"));
        assertEq(registry.policyVersion(owner), 1);
    }

    function test_CommitPolicyEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit BondedRegistry.PolicyCommitted(bytes32("policy-v1"), owner, 1);

        vm.prank(owner);
        registry.commitPolicy(bytes32("policy-v1"));
    }

    function test_RecommitOverwritesHashAndAdvancesVersion() public {
        vm.startPrank(owner);
        registry.commitPolicy(bytes32("policy-v1"));
        registry.commitPolicy(bytes32("policy-v2"));
        vm.stopPrank();

        assertEq(registry.currentPolicyHash(owner), bytes32("policy-v2"));
        assertEq(registry.policyVersion(owner), 2);
    }

    /// @notice Version only ever advances via commitPolicy, one direction —
    /// there is no rollback function, and re-committing an EARLIER hash still
    /// advances the version rather than reverting to a prior one. This is the
    /// on-chain half of the enforcer's STALE_POLICY check: a proposal
    /// evaluated against an old policyHash is refused, never silently
    /// re-accepted just because that hash was committed at some point.
    function test_VersionNeverGoesBackward() public {
        vm.startPrank(owner);
        registry.commitPolicy(bytes32("policy-v1"));
        registry.commitPolicy(bytes32("policy-v2"));
        registry.commitPolicy(bytes32("policy-v1")); // re-commit the OLD hash
        vm.stopPrank();

        assertEq(registry.currentPolicyHash(owner), bytes32("policy-v1"));
        assertEq(registry.policyVersion(owner), 3, "version must keep advancing, never reset");
    }

    function test_RevertsOnZeroPolicyHash() public {
        vm.prank(owner);
        vm.expectRevert(BondedRegistry.ZeroPolicyHash.selector);
        registry.commitPolicy(bytes32(0));
    }

    function test_PolicyHashesAreIsolatedPerOwner() public {
        vm.prank(owner);
        registry.commitPolicy(bytes32("owner-policy"));

        vm.prank(other);
        registry.commitPolicy(bytes32("other-policy"));

        assertEq(registry.currentPolicyHash(owner), bytes32("owner-policy"));
        assertEq(registry.currentPolicyHash(other), bytes32("other-policy"));
        assertEq(registry.policyVersion(owner), 1);
        assertEq(registry.policyVersion(other), 1);
    }

    function test_UncommittedOwnerReadsZero() public view {
        assertEq(registry.currentPolicyHash(other), bytes32(0));
        assertEq(registry.policyVersion(other), 0);
    }

    function testFuzz_VersionAlwaysEqualsNumberOfCommits(uint8 numCommits) public {
        vm.assume(numCommits > 0 && numCommits <= 50);

        vm.startPrank(owner);
        for (uint256 i = 0; i < numCommits; i++) {
            registry.commitPolicy(keccak256(abi.encodePacked("policy", i)));
        }
        vm.stopPrank();

        assertEq(registry.policyVersion(owner), numCommits);
    }
}
