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
 * The vault has to be redeployed rather than reconfigured because
 * IRREVERSIBLE_ABOVE is a compile-time constant and enrolledSigner is
 * immutable. Both are deliberate: a threshold that can be lowered at runtime
 * by whoever holds a key is not much of a threshold.
 *
 * The old vault keeps whatever USDC it holds — there is no withdraw function,
 * so drain it with the settlement package's `recover` script BEFORE pointing
 * anything at the new address.
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
        console.log("IRREVERSIBLE_ABOVE: ", vault.IRREVERSIBLE_ABOVE());
        console.log("BUDGET_MAX:         ", vault.BUDGET_MAX());
    }
}
