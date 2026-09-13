// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BondedVault} from "../src/BondedVault.sol";

/**
 * Deploy a BondedVault against an EXISTING BondedRegistry.
 *
 * Separate from Deploy.s.sol, which deploys both. Redeploying the registry
 * would discard every committed policy hash and force a re-commit, and the
 * subgraph's registry data source would have to be re-pointed as well — none
 * of which is wanted when the only thing changing is a vault constant.
 *
 * enrolledSigner is immutable, so adopting a different verdict-signing key
 * means a redeploy rather than a setter.
 *
 * Thresholds are per owner now, set by the owner through setLimits, with the
 * constants below as the fallback for an owner that has not. An owner lowering
 * its own ceiling is the owner protecting its own funds; the key that cannot
 * move a threshold is the enforcer signing key, which never could.
 *
 * Drain the outgoing vault BEFORE pointing anything at the new address. A
 * vault running the pre-ownership bytecode has no withdraw function, so use
 * the settlement package `recover` script; deposits into this deployment come
 * back out through withdraw().
 */
contract DeployVault is Script {
    function run() external {
        address registry       = vm.envAddress("BONDED_REGISTRY_ADDRESS");
        address enrolledSigner = vm.envAddress("ENFORCER_SIGNER_ADDRESS");
        address usdc           = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        BondedVault vault = new BondedVault(registry, enrolledSigner, usdc);
        vm.stopBroadcast();

        console.log("BondedVault:        ", address(vault));
        console.log("registry:           ", registry);
        console.log("enrolledSigner:     ", enrolledSigner);
        console.log("default step-up above: ", vault.DEFAULT_IRREVERSIBLE_ABOVE());
        console.log("default budget max:    ", vault.DEFAULT_BUDGET_MAX());
        console.log("");
        console.log("Limits are now per owner. An owner that never calls");
        console.log("setLimits falls back to the defaults above.");
    }
}
