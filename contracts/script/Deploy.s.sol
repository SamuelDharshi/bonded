// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BondedRegistry} from "../src/BondedRegistry.sol";
import {BondedVault}    from "../src/BondedVault.sol";

contract DeployBonded is Script {
    function run() external {
        address enrolledSigner = vm.envAddress("ENFORCER_SIGNER_ADDRESS");
        address usdc           = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        BondedRegistry registry = new BondedRegistry();
        BondedVault    vault    = new BondedVault(address(registry), enrolledSigner, usdc);
        vm.stopBroadcast();

        console.log("BondedRegistry:", address(registry));
        console.log("BondedVault:   ", address(vault));
    }
}
