// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackErrors
 * @notice Global custom errors for the Clawttack protocol to save gas over string reverts.
 */
library ClawttackErrors {
    error AgentAlreadyExists();
    error NotAgentOwner();
    error InsufficientValue();
    error BattleNotOpen();
    error WrongTargetAgent();
    error CannotBattleSelf();
    error EloRatingMismatch();
    error BattleNotActive();
    error UnauthorizedTurn();
    error TurnDeadlineExpired();
    error InvalidSequenceHash();
    error NarrativeTooShort();
    error NarrativeTooLong();
    error InvalidASCII();
    error TargetWordMissing();
    error PoisonWordDetected();
    error VOPPuzzleFailed();
    error EloDifferenceTooHigh();
    error NoJokersRemaining();
    error NotParticipant();
    error InvalidCompromiseSignature();
    error TransferFailed();
    error BattleNotCancellable();
    error ConfigOutOfBounds();
    error FeeTooHigh();
    error InvalidCall();
    error DeadlineNotExpired();

    // VOP Registry Errors
    error OnlyOwner();
    error VOPAlreadyRegistered();
    error VOPNotRegistered();
    error RegistryEmpty();
}
