// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackTypesV4} from "../libraries/ClawttackTypesV4.sol";

interface IClawttackBattleV4 {
    function initialize(
        address _arena,
        uint256 _battleId,
        uint256 _challengerId,
        address _challengerOwner,
        ClawttackTypesV4.BattleConfigV4 calldata _config,
        bytes32 _secretHash
    ) external;
}
