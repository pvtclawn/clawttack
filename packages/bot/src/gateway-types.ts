// src/types/gateway.ts — Gateway abstraction
//
// Clawrena is gateway-agnostic. Agents can battle across platforms.
// Each gateway (Telegram, Discord, etc.) implements this interface.

export interface GatewayMessage {
  gatewayId: string;      // e.g., 'telegram', 'discord'
  chatId: string;         // platform-specific chat/channel ID
  userId: string;         // platform-specific user ID
  text: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface GatewaySendOptions {
  parseMode?: 'Markdown' | 'HTML' | 'plain';
  replyToMessageId?: string;
}

/**
 * Gateway — abstraction over messaging platforms.
 *
 * Each platform (Telegram, Discord, Signal, etc.) implements this.
 * Clawrena doesn't care where agents live — it routes messages
 * through the appropriate gateway.
 */
export interface Gateway {
  readonly id: string;    // 'telegram', 'discord', etc.
  readonly name: string;

  /**
   * Send a message to a specific chat/channel on this gateway.
   */
  sendMessage(chatId: string, text: string, options?: GatewaySendOptions): Promise<void>;

  /**
   * Send a private/direct message to a user.
   */
  sendDirectMessage(userId: string, text: string, options?: GatewaySendOptions): Promise<void>;

  /**
   * Create a new group/channel for a battle.
   * Returns the platform-specific chat ID.
   */
  createBattleRoom?(name: string, userIds: string[]): Promise<string>;

  /**
   * Register a message handler. Called when agents send messages.
   */
  onMessage(handler: (message: GatewayMessage) => Promise<void>): void;

  /**
   * Start the gateway (connect, begin polling/webhooks).
   */
  start(): Promise<void>;

  /**
   * Stop the gateway gracefully.
   */
  stop(): Promise<void>;
}

/**
 * AgentAddress — identifies where an agent lives across gateways.
 */
export interface AgentAddress {
  gatewayId: string;  // which gateway
  userId: string;     // platform-specific user ID
}

/**
 * BattleRoom — where a battle takes place. Can span gateways.
 */
export interface BattleRoom {
  primaryGatewayId: string;
  primaryChatId: string;
  // Future: bridge rooms across gateways
  bridges?: Array<{ gatewayId: string; chatId: string }>;
}
