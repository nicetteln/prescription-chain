export const API_URL = "http://localhost:3000";
export const CONTRACT = {
  "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "chainId": "31337",
  "abi": [
    {
      "type": "constructor",
      "stateMutability": "undefined",
      "payable": false,
      "inputs": []
    },
    {
      "type": "error",
      "name": "AlreadyRegistered",
      "inputs": []
    },
    {
      "type": "error",
      "name": "EmptyId",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotAuthorized",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotOwner",
      "inputs": []
    },
    {
      "type": "event",
      "anonymous": false,
      "name": "AuthorizationChanged",
      "inputs": [
        {
          "type": "address",
          "name": "account",
          "indexed": true
        },
        {
          "type": "bool",
          "name": "allowed",
          "indexed": false
        }
      ]
    },
    {
      "type": "event",
      "anonymous": false,
      "name": "PrescriptionRegistered",
      "inputs": [
        {
          "type": "string",
          "name": "id",
          "indexed": false
        },
        {
          "type": "bytes32",
          "name": "hash",
          "indexed": false
        },
        {
          "type": "string",
          "name": "cid",
          "indexed": false
        },
        {
          "type": "uint256",
          "name": "timestamp",
          "indexed": false
        },
        {
          "type": "address",
          "name": "registeredBy",
          "indexed": true
        }
      ]
    },
    {
      "type": "function",
      "name": "authorized",
      "constant": true,
      "stateMutability": "view",
      "payable": false,
      "inputs": [
        {
          "type": "address",
          "name": ""
        }
      ],
      "outputs": [
        {
          "type": "bool",
          "name": ""
        }
      ]
    },
    {
      "type": "function",
      "name": "getPrescription",
      "constant": true,
      "stateMutability": "view",
      "payable": false,
      "inputs": [
        {
          "type": "string",
          "name": "id"
        }
      ],
      "outputs": [
        {
          "type": "bytes32",
          "name": "hash"
        },
        {
          "type": "string",
          "name": "cid"
        },
        {
          "type": "uint256",
          "name": "timestamp"
        }
      ]
    },
    {
      "type": "function",
      "name": "isRegistered",
      "constant": true,
      "stateMutability": "view",
      "payable": false,
      "inputs": [
        {
          "type": "string",
          "name": "id"
        }
      ],
      "outputs": [
        {
          "type": "bool",
          "name": ""
        }
      ]
    },
    {
      "type": "function",
      "name": "owner",
      "constant": true,
      "stateMutability": "view",
      "payable": false,
      "inputs": [],
      "outputs": [
        {
          "type": "address",
          "name": ""
        }
      ]
    },
    {
      "type": "function",
      "name": "register",
      "constant": false,
      "payable": false,
      "inputs": [
        {
          "type": "string",
          "name": "id"
        },
        {
          "type": "bytes32",
          "name": "hash"
        },
        {
          "type": "string",
          "name": "cid"
        }
      ],
      "outputs": []
    },
    {
      "type": "function",
      "name": "setAuthorized",
      "constant": false,
      "payable": false,
      "inputs": [
        {
          "type": "address",
          "name": "account"
        },
        {
          "type": "bool",
          "name": "allowed"
        }
      ],
      "outputs": []
    }
  ]
};
