// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PrescriptionRegistry
/// @notice Stores the SHA-256 hash and IPFS CID of prescription PDFs.
///         Only authorized accounts can register, and a record can never be overwritten.
contract PrescriptionRegistry {
    struct Prescription {
        bytes32 hash;      // SHA-256 of the PDF
        string cid;        // IPFS content identifier of the PDF
        uint256 timestamp; // block time of registration (0 means "not registered")
    }

    address public owner;
    mapping(address => bool) public authorized;
    mapping(string => Prescription) private prescriptions;
    mapping(bytes32 => bool) private hashUsed; // a given file can be registered only once

    event PrescriptionRegistered(
        string id,
        bytes32 hash,
        string cid,
        uint256 timestamp,
        address indexed registeredBy
    );
    event AuthorizationChanged(address indexed account, bool allowed);

    error NotOwner();
    error NotAuthorized();
    error EmptyId();
    error AlreadyRegistered();
    error HashAlreadyRegistered();

    constructor() {
        owner = msg.sender;
        authorized[msg.sender] = true;
        emit AuthorizationChanged(msg.sender, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!authorized[msg.sender]) revert NotAuthorized();
        _;
    }

    /// @notice Grant or revoke the right to register prescriptions.
    function setAuthorized(address account, bool allowed) external onlyOwner {
        authorized[account] = allowed;
        emit AuthorizationChanged(account, allowed);
    }

    /// @notice Register a prescription. Reverts if the ID is empty or already used,
    ///         or if the same file (same hash) was already registered under another ID.
    function register(string calldata id, bytes32 hash, string calldata cid)
        external
        onlyAuthorized
    {
        if (bytes(id).length == 0) revert EmptyId();
        if (prescriptions[id].timestamp != 0) revert AlreadyRegistered();
        if (hashUsed[hash]) revert HashAlreadyRegistered();

        hashUsed[hash] = true;
        prescriptions[id] = Prescription(hash, cid, block.timestamp);
        emit PrescriptionRegistered(id, hash, cid, block.timestamp, msg.sender);
    }

    /// @notice Read a record. For an unknown ID, all returned values are zero/empty.
    function getPrescription(string calldata id)
        external
        view
        returns (bytes32 hash, string memory cid, uint256 timestamp)
    {
        Prescription storage p = prescriptions[id];
        return (p.hash, p.cid, p.timestamp);
    }

    function isRegistered(string calldata id) external view returns (bool) {
        return prescriptions[id].timestamp != 0;
    }

    function isHashRegistered(bytes32 hash) external view returns (bool) {
        return hashUsed[hash];
    }
}
