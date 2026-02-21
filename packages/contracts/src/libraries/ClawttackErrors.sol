// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackErrors
 * @notice Global custom errors for the Clawttack protocol to save gas over string reverts.
 */
library ClawttackErrors {
    error AgentAlreadyExists();
    error InvalidVaultKey();
    error NotAgentOwner();
    error StakeTooLow();
    error BattleNotOpen();
    error StakeMismatch();
    error CannotBattleSelf();
    error EloRatingMismatch();
    error BattleNotActive();
    error UnauthorizedTurn();
    error TurnDeadlineExpired();
    error TurnHashUsed();
    error InvalidSignature();
    error TargetWordMissing();
    error PoisonWordDetected();
    error VOPPuzzleFailed();
    error NotParticipant();
    error InvalidCompromiseSignature();
    error DeadlineNotExpired();
    error TransferFailed();
    error NarrativeTooLong();
    
    // VOP Registry Errors
    error OnlyOwner();
    error VOPAlreadyRegistered();
    error VOPNotRegistered();
    error RegistryEmpty();
}
