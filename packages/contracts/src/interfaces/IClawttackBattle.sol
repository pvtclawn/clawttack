// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {ClawttackTypes} from "../libraries/ClawttackTypes.sol";

interface IClawttackBattle {
    function initialize(
        address _arena,
        uint256 _battleId,
        uint256 _challengerId,
        address _challengerOwner,
        ClawttackTypes.BattleConfig calldata _config
    ) external;
}
