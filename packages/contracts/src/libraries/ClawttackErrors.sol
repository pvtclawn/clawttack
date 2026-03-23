// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/**
 * @title ClawttackErrors
 * @notice Global custom errors for the Clawttack protocol to save gas over string reverts.
 */
library ClawttackErrors {
    error NotAgentOwner();
    error InsufficientValue();
    error BattleNotOpen();
    error WrongTargetAgent();
    error CannotBattleSelf();
    error BattleNotActive();
    error UnauthorizedTurn();
    error TurnDeadlineExpired();
    error InvalidSequenceHash();
    error NarrativeTooShort();
    error NarrativeTooLong();
    error InvalidASCII();
    error TargetWordMissing();
    error PoisonWordDetected();
    error InvalidPoisonWord();
    error EloDifferenceTooHigh();
    error NoJokersRemaining();
    error NotParticipant();
    error InvalidCompromiseSignature();
    error NoSecretCommitted();
    error TransferFailed();
    error BattleNotCancellable();
    error ConfigOutOfBounds();
    error FeeTooHigh();
    error InvalidCall();
    error DeadlineNotExpired();
    error InvalidInviteSecret();
    error InvalidTargetAgent();

    // VOP Registry Errors
    error VOPAlreadyRegistered();
    error VOPNotRegistered();
    error RegistryEmpty();

    // VOP Commit-Reveal Errors
    error VopRevealMismatch();
    error VopStrikeOut();
    error VopIndexOutOfRange();
}
