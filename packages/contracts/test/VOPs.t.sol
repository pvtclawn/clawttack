// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/vops/TWAPOracleVOP.sol";
import "../src/vops/L1MetadataVOP.sol";
import "../src/vops/HashPreimageVOP.sol";
import "../src/vops/CrossChainSyncVOP.sol";

// Mock L1Block Predeploy
contract MockL1Block {
    uint64 public number = 10000;
    uint256 public basefee = 50 gwei;
}

// Mock Uniswap Pool
// Returns a set of values so we can simulate TWAP
contract MockUniswapV3Pool {
    int56 delta;
    constructor(int56 _delta) {
        delta = _delta;
    }
    
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory)
    {
        tickCumulatives = new int56[](secondsAgos.length);
        // Simulate tickCumulatives[0] = 0, tickCumulatives[1] = delta
        tickCumulatives[0] = 0;
        tickCumulatives[1] = delta;
        return (tickCumulatives, new uint160[](secondsAgos.length));
    }
}

contract VOPsTest is Test {
    HashPreimageVOP hashVOP;
    TWAPOracleVOP twapVOP;
    L1MetadataVOP l1VOP;
    CrossChainSyncVOP syncVOP;

    MockUniswapV3Pool mockPool;
    
    function setUp() public {
        hashVOP = new HashPreimageVOP();
        twapVOP = new TWAPOracleVOP();
        l1VOP = new L1MetadataVOP();
        syncVOP = new CrossChainSyncVOP();
        
        // Mock L1Block Predeploy
        // The address is constant in L1MetadataVOP: 0x420...15
        address l1Block = 0x4200000000000000000000000000000000000015;
        // Etch the mock logic onto the predeploy address
        MockL1Block mockL1 = new MockL1Block();
        vm.etch(l1Block, address(mockL1).code);
        
        // Set storage
        vm.store(l1Block, bytes32(0), bytes32(uint256(10000))); // Slot 0 is mostly likely where `number` sits in Mock
        vm.store(l1Block, bytes32(uint256(1)), bytes32(uint256(50 gwei))); // Slot 1 for basefee
        
        mockPool = new MockUniswapV3Pool(12000); // delta = 12000
    }

    function test_HashPreimageVOP() public {
        bytes32 salt = keccak256("test salt");
        // We want leading Zero Bits = 8
        // Let's find a valid solution
        uint256 solution = 0;
        while (true) {
            bytes32 hash = keccak256(abi.encode(salt, solution));
            if ((uint256(hash) >> (256 - 8)) == 0) {
                break;
            }
            solution++;
        }
        
        bytes memory params = abi.encode(salt, uint8(8));
        assertTrue(hashVOP.verify(params, solution, block.number));
        
        // Invalid solution
        assertFalse(hashVOP.verify(params, solution + 1, block.number));
        
        // Require > 256 zeros -> false
        bytes memory paramsImpossible = abi.encode(salt, uint8(255));
        assertFalse(hashVOP.verify(paramsImpossible, solution, block.number));
    }

    function test_L1MetadataVOP() public {
        uint256 salt = 12345;
        bytes memory params = abi.encode(salt);
        
        // Expected = keccak256(abi.encode(10000, 50gwei, salt))
        uint256 expected = uint256(keccak256(abi.encode(uint64(10000), uint256(50 gwei), salt)));
        
        assertTrue(l1VOP.verify(params, expected, block.number));
        assertFalse(l1VOP.verify(params, expected + 1, block.number));
    }

    function test_TWAPOracleVOP() public {
        // Delta = 12000. secondsAgo = 10. AvgTick = 1200.
        bytes memory params = abi.encode(address(mockPool), uint32(10));
        
        assertTrue(twapVOP.verify(params, 1200, block.number));
        assertFalse(twapVOP.verify(params, 1201, block.number));
    }
    
    function test_CrossChainSyncVOP() public {
        // basefee = 50 gwei
        // AvgTick = 1200
        // expected = 50 gwei ^ uint256(int256(1200))
        uint256 expected = uint256(50 gwei) ^ uint256(1200);
        bytes memory params = abi.encode(address(mockPool), uint32(10));
        
        assertTrue(syncVOP.verify(params, expected, block.number));
        assertFalse(syncVOP.verify(params, expected + 1, block.number));
    }
}
