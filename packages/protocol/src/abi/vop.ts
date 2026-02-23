export const IVERIFIABLE_ORACLE_PRIMITIVE_ABI = [
  {
    "type": "function",
    "name": "verify",
    "inputs": [
      {
        "name": "params",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "solution",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "error",
    "name": "VerificationFailed",
    "inputs": [
      {
        "name": "reason",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const;
