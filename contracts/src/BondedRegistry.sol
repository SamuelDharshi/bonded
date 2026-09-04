// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BondedRegistry
/// @notice Stores a keccak256 hash of each agent's current policy artifact on-chain.
///         The enforcer checks this hash before countersigning any verdict, ensuring
///         the evaluated policy is exactly what the agent committed to.
contract BondedRegistry {
    // ─── Storage ─────────────────────────────────────────────────────────────

    /// @dev Current policy hash per owner address
    mapping(address => bytes32) private _policyHash;

    /// @dev Monotonically increasing version counter; incremented on every commit
    mapping(address => uint256) private _version;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted whenever an agent commits (or updates) their policy hash.
    event PolicyCommitted(
        bytes32 indexed policyHash,
        address indexed owner,
        uint256 version
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroPolicyHash();

    // ─── External Functions ───────────────────────────────────────────────────

    /// @notice Commit (or update) the caller's policy hash.
    function commitPolicy(bytes32 policyHash) external {
        if (policyHash == bytes32(0)) revert ZeroPolicyHash();

        _policyHash[msg.sender] = policyHash;
        uint256 newVersion = _version[msg.sender] + 1;
        _version[msg.sender] = newVersion;

        emit PolicyCommitted(policyHash, msg.sender, newVersion);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function currentPolicyHash(address owner) external view returns (bytes32) {
        return _policyHash[owner];
    }

    function policyVersion(address owner) external view returns (uint256) {
        return _version[owner];
    }
}
