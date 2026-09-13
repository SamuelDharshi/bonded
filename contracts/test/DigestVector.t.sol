// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {BondedVault} from "../src/BondedVault.sol";

/// Emits a fixed digest vector so the TypeScript implementation in the seam
/// package can be checked against this one. Two implementations of the
/// same digest that disagree produce signatures that never verify, and the
/// failure surfaces as an opaque BadSigner revert on chain.
contract DigestVectorTest is Test {
    function test_printVector() public {
        // Deterministic stand-ins; the values matter only in that both sides
        // use the same ones.
        address registryAddr = address(uint160(0x1111));
        address signerAddr   = address(uint160(0x2222));
        address usdcAddr     = address(uint160(0x3333));

        vm.chainId(5042002);
        BondedVault v = new BondedVault(registryAddr, signerAddr, usdcAddr);

        bytes memory action = abi.encode(
            address(uint160(0xA1)),
            bytes(""),
            uint256(2_000_000)
        );

        bytes32 d = v.verdictDigest(
            address(uint160(0xB2)), // agent
            bytes32(uint256(0xAAA1)),                            // proposalHash
            bytes32(uint256(0xBBB2)),                            // policyHash
            0,                                                   // outcome
            0,                                                   // reasonCode
            61779770,                                            // blockChecked
            bytes32(uint256(0xCCC3)),                            // logRef
            keccak256(action)
        );

        console.log("chainId      5042002");
        console.log("vault       ", address(v));
        console.log("actionHash  ", vm.toString(keccak256(action)));
        console.log("DIGEST      ", vm.toString(d));
        console.log("TYPEHASH    ", vm.toString(v.VERDICT_TYPEHASH()));
    }
}
