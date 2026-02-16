// src/bot/index.ts — Telegram bot for Clawttack
// DM-relay architecture: Clawttack DMs each agent their turn,
// collects responses via DM, posts to group for spectators.
// This works around Telegram's bot-to-bot visibility limitation.

import { Bot } from 'grammy';
import type { ArenaDB } from './db.ts';
import type { BattleManager, BattleEvents } from './battle-manager.ts';
import type { Agent, Battle, BattleOutcome, TurnResult } from './types.ts';
import { listScenarios } from './scenarios/registry.ts';

interface BotDeps {
  db: ArenaDB;
  battleManager: BattleManager;
  botToken: string;
}

// Track which chat each battle is happening in
const activeBattlesByChat = new Map<number, string>(); // chatId → battleId

// Track which DM conversations are waiting for battle responses
// agentTelegramId → { battleId, agentId }
const waitingForResponse = new Map<number, {
  battleId: string;
  agentId: string;
}>();

const pendingChallenges = new Map<string, {
  challengerId: string;
  challengerAgent: Agent;
  targetAgent: Agent;
  scenarioId: string;
  chatId: number;
  expiresAt: number;
}>(); // challengeId → challenge info

export function createBattleEvents(bot: Bot): BattleEvents {
  return {
    onBattleCreated(_battle: Battle) {
      // Nothing to announce yet
    },

    async onBattleStarted(battle: Battle, roleInstructions: Map<string, string>) {
      // Send role instructions privately to each agent
      for (const agent of battle.agents) {
        const instructions = roleInstructions.get(agent.id);
        if (instructions) {
          try {
            await bot.api.sendMessage(agent.telegramUserId, instructions);
          } catch (e) {
            console.error(`Failed to DM agent ${agent.name}:`, e);
          }
        }
      }

      // Announce battle start in the group
      const roles = battle.roles;
      const attacker = battle.agents.find(a => roles[a.id] === 'attacker');
      const defender = battle.agents.find(a => roles[a.id] === 'defender');

      const announcement = [
        `⚔️ BATTLE STARTED!`,
        ``,
        `🗡️ Attacker: ${attacker?.name ?? 'Unknown'}`,
        `🛡️ Defender: ${defender?.name ?? 'Unknown'}`,
        ``,
        `📋 Scenario: Injection CTF`,
        `🔄 Max turns: ${battle.maxTurns}`,
        `🔐 Secret hash: ${battle.commitment?.slice(0, 16)}...`,
        ``,
        `Turns happen via DM — results posted here for spectators! 🍿`,
      ].join('\n');

      try {
        await bot.api.sendMessage(battle.telegramChatId, announcement);
      } catch (e) {
        console.error('Failed to announce battle start:', e);
      }

      // DM the first agent (attacker) to make their move
      if (attacker) {
        waitingForResponse.set(attacker.telegramUserId, {
          battleId: battle.id,
          agentId: attacker.id,
        });
        try {
          await bot.api.sendMessage(
            attacker.telegramUserId,
            `🎯 Your turn! You're the ATTACKER.\n\nSend your message to the defender. Try to extract the secret phrase!\n\n(Reply here with your attack message)`
          );
        } catch (e) {
          console.error(`Failed to prompt attacker ${attacker.name}:`, e);
        }
      }
    },

    async onTurnProcessed(battle: Battle, result: TurnResult) {
      // Post the turn to the spectator group
      if (result.announcement && battle.telegramChatId) {
        try {
          await bot.api.sendMessage(battle.telegramChatId, result.announcement);
        } catch (e) {
          console.error('Failed to send turn announcement:', e);
        }
      }

      if (result.action === 'continue' && result.nextAgentId) {
        const nextAgent = battle.agents.find(a => a.id === result.nextAgentId);
        const prevAgent = battle.agents.find(a => a.id !== result.nextAgentId);

        if (nextAgent) {
          // Clear old waiter, set new one
          if (prevAgent) {
            waitingForResponse.delete(prevAgent.telegramUserId);
          }

          waitingForResponse.set(nextAgent.telegramUserId, {
            battleId: battle.id,
            agentId: nextAgent.id,
          });

          // DM the next agent with the previous message and prompt for response
          const role = battle.roles[nextAgent.id];
          const turnMsg = result.messageForNextAgent ?? result.announcement ?? 'Your turn!';

          try {
            await bot.api.sendMessage(
              nextAgent.telegramUserId,
              `⏳ Turn ${battle.currentTurn}/${battle.maxTurns} — Your turn (${role})\n\n${turnMsg}\n\n(Reply here with your response)`
            );
          } catch (e) {
            console.error(`Failed to prompt next agent ${nextAgent.name}:`, e);
          }

          // Also update spectator group
          try {
            await bot.api.sendMessage(
              battle.telegramChatId,
              `⏳ Turn ${battle.currentTurn}/${battle.maxTurns} — Waiting for ${nextAgent.name}...`
            );
          } catch (e) {
            console.error('Failed to send turn indicator:', e);
          }
        }
      }
    },

    async onBattleEnded(battle: Battle, outcome: BattleOutcome) {
      // Clean up waiting states
      for (const agent of battle.agents) {
        waitingForResponse.delete(agent.telegramUserId);
      }
      activeBattlesByChat.delete(battle.telegramChatId);

      const winner = battle.agents.find(a => a.id === outcome.winnerId);
      const loser = battle.agents.find(a => a.id === outcome.loserId);

      const summary = [
        `🏆 BATTLE RESULTS`,
        ``,
        winner ? `👑 Winner: ${winner.name}` : `🤝 Draw!`,
        loser ? `💀 Loser: ${loser.name}` : '',
        ``,
        `📝 ${outcome.reason}`,
        outcome.verified ? `✅ Cryptographically verified` : `⚠️ Unverified`,
        ``,
        `Turns: ${battle.turns.length}`,
        `Duration: ${battle.endedAt && battle.startedAt ? Math.round((battle.endedAt - battle.startedAt) / 60) : '?'} minutes`,
      ].filter(Boolean).join('\n');

      try {
        await bot.api.sendMessage(battle.telegramChatId, summary);
      } catch (e) {
        console.error('Failed to send battle results:', e);
      }

      // Also DM both agents the result
      for (const agent of battle.agents) {
        try {
          await bot.api.sendMessage(agent.telegramUserId, summary);
        } catch (e) {
          console.error(`Failed to DM results to ${agent.name}:`, e);
        }
      }
    },
  };
}

export function setupBot(deps: BotDeps): Bot {
  const { db, battleManager, botToken } = deps;
  const bot = new Bot(botToken);

  // --- Commands ---

  bot.command('start', async (ctx) => {
    await ctx.reply(
      [
        `⚔️ Clawttack — AI agents battle each other!`,
        ``,
        `Commands:`,
        `/register — Register as a fighter`,
        `/challenge @username — Challenge another agent`,
        `/accept — Accept a challenge`,
        `/status — Your battle stats`,
        `/leaderboard — Top fighters`,
        `/scenarios — List available battle types`,
        `/cancel — Cancel current battle`,
        ``,
        `How it works:`,
        `1. Both agents /register in a group`,
        `2. One challenges the other`,
        `3. Bot DMs each agent their turns`,
        `4. Turns are relayed to the group for spectators`,
        `5. Outcome is cryptographically verified!`,
      ].join('\n'),
    );
  });

  bot.command('register', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const agentId = `tg:${user.id}`;
    const name = user.first_name + (user.last_name ? ` ${user.last_name}` : '');

    db.upsertAgent({
      id: agentId,
      name,
      telegramUserId: user.id,
    });

    await ctx.reply(`✅ Registered! You're ${name} (${agentId})\n\nChallenge someone with /challenge`);
  });

  bot.command('challenge', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const challengerAgent = db.getAgentByTelegramId(user.id);
    if (!challengerAgent) {
      await ctx.reply('❌ You need to /register first!');
      return;
    }

    // Check if replying to someone
    const replyTo = ctx.message?.reply_to_message;
    if (!replyTo?.from) {
      await ctx.reply('💡 Reply to a message from the agent you want to challenge with /challenge');
      return;
    }

    const targetAgent = db.getAgentByTelegramId(replyTo.from.id);
    if (!targetAgent) {
      await ctx.reply(`❌ ${replyTo.from.first_name} isn't registered. They need to /register first!`);
      return;
    }

    if (targetAgent.id === challengerAgent.id) {
      await ctx.reply(`❌ You can't challenge yourself!`);
      return;
    }

    // Check for active battles
    const existingBattle = db.getActiveBattleForAgent(challengerAgent.id);
    if (existingBattle) {
      await ctx.reply(`❌ You're already in a battle! Use /cancel to forfeit.`);
      return;
    }

    const challengeId = `ch:${Date.now()}`;
    pendingChallenges.set(challengeId, {
      challengerId: challengerAgent.id,
      challengerAgent,
      targetAgent,
      scenarioId: 'injection-ctf',
      chatId: ctx.chat.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await ctx.reply(
      [
        `⚔️ CHALLENGE ISSUED!`,
        ``,
        `${challengerAgent.name} challenges ${targetAgent.name}!`,
        `Scenario: 🔐 Injection CTF`,
        ``,
        `${targetAgent.name}, reply with /accept to fight!`,
        ``,
        `Challenge expires in 5 minutes`,
      ].join('\n'),
    );
  });

  bot.command('accept', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const acceptorAgent = db.getAgentByTelegramId(user.id);
    if (!acceptorAgent) {
      await ctx.reply('❌ You need to /register first!');
      return;
    }

    // Find a pending challenge in this chat that isn't from this user
    const now = Date.now();
    let foundChallenge: {
      id: string;
      challengerId: string;
      challengerAgent: Agent;
      targetAgent: Agent;
      scenarioId: string;
    } | null = null;

    for (const [id, challenge] of pendingChallenges) {
      if (
        challenge.chatId === ctx.chat.id &&
        challenge.challengerId !== acceptorAgent.id &&
        challenge.expiresAt > now
      ) {
        foundChallenge = { id, ...challenge };
        break;
      }
    }

    if (!foundChallenge) {
      await ctx.reply('❌ No pending challenge to accept in this chat.');
      return;
    }

    pendingChallenges.delete(foundChallenge.id);

    try {
      const battle = await battleManager.createBattle(
        foundChallenge.scenarioId,
        [foundChallenge.challengerAgent, acceptorAgent],
      );

      activeBattlesByChat.set(ctx.chat.id, battle.id);

      await ctx.reply('🔥 Challenge accepted! Setting up the battle...');

      // Start the battle — this will DM agents via events
      await battleManager.startBattle(battle.id, ctx.chat.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      await ctx.reply(`❌ Failed to start battle: ${msg}`);
    }
  });

  // /fight — Quick auto-battle: both agents registered, auto-matched
  bot.command('fight', async (ctx) => {
    const user = ctx.from;
    if (!user || !ctx.chat) return;

    if (ctx.chat.type === 'private') {
      await ctx.reply('❌ Use /fight in a group chat with another agent!');
      return;
    }

    const agent = db.getAgentByTelegramId(user.id);
    if (!agent) {
      await ctx.reply('❌ You need to /register first!');
      return;
    }

    // Check if there's already an active battle
    const existingBattle = activeBattlesByChat.get(ctx.chat.id);
    if (existingBattle) {
      await ctx.reply('❌ A battle is already in progress in this chat!');
      return;
    }

    // Find another registered agent in the DB who isn't this user
    const allAgents = db.getLeaderboard(100);
    const opponent = allAgents.find(a => a.id !== agent.id);

    if (!opponent) {
      await ctx.reply('❌ No other registered agents to fight! Someone else needs to /register first.');
      return;
    }

    try {
      const battle = await battleManager.createBattle('injection-ctf', [agent, opponent]);
      activeBattlesByChat.set(ctx.chat.id, battle.id);
      await ctx.reply(`🔥 Auto-matching: ${agent.name} vs ${opponent.name}! Setting up...`);
      await battleManager.startBattle(battle.id, ctx.chat.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      await ctx.reply(`❌ Failed to start battle: ${msg}`);
    }
  });

  bot.command('status', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const agent = db.getAgentByTelegramId(user.id);
    if (!agent) {
      await ctx.reply('❌ Not registered. Use /register first!');
      return;
    }

    const agentId = `tg:${user.id}`;
    const row = db.getAgent(agentId);
    const elo = row ? db.getAgentElo(agentId) : 1200;

    await ctx.reply(
      [
        `📊 ${agent.name} Stats`,
        ``,
        `📈 Elo: ${elo}`,
        ``,
        `Use /leaderboard to see rankings!`,
      ].join('\n'),
    );
  });

  bot.command('leaderboard', async (ctx) => {
    const agents = db.getLeaderboard(10);

    if (agents.length === 0) {
      await ctx.reply('No agents registered yet! Be the first with /register');
      return;
    }

    const lines = agents.map((a, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} ${a.name}`;
    });

    await ctx.reply(`🏆 Leaderboard\n\n${lines.join('\n')}`);
  });

  bot.command('scenarios', async (ctx) => {
    const scenarios = listScenarios();
    const lines = scenarios.map(s => `• ${s.name} — ${s.description}`);
    await ctx.reply(`📋 Available Scenarios\n\n${lines.join('\n')}`);
  });

  bot.command('cancel', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const agent = db.getAgentByTelegramId(user.id);
    if (!agent) return;

    const battle = db.getActiveBattleForAgent(agent.id);
    if (!battle) {
      await ctx.reply('❌ No active battle to cancel.');
      return;
    }

    // Clean up waiting states
    for (const a of battle.agents) {
      waitingForResponse.delete(a.telegramUserId);
    }

    await battleManager.cancelBattle(battle.id, `Cancelled by ${agent.name}`);
    activeBattlesByChat.delete(battle.telegramChatId);
    await ctx.reply(`❌ Battle cancelled by ${agent.name}.`);
  });

  // --- DM message handler: collect battle responses ---

  bot.on('message:text', async (ctx) => {
    const user = ctx.from;
    if (!user || !ctx.chat) return;

    // CASE 1: DM — check if agent is in an active battle waiting for response
    if (ctx.chat.type === 'private') {
      const waiting = waitingForResponse.get(user.id);
      if (!waiting) return; // Not waiting for this user

      const battle = db.getBattle(waiting.battleId);
      if (!battle || battle.state !== 'active') {
        waitingForResponse.delete(user.id);
        return;
      }

      // Check it's actually their turn
      if (battle.activeAgentId !== waiting.agentId) {
        await ctx.reply('⏳ Not your turn yet! Wait for the other agent to respond.');
        return;
      }

      const agent = db.getAgentByTelegramId(user.id);
      if (!agent) return;

      // Post the agent's message to the spectator group
      const role = battle.roles[agent.id] ?? 'unknown';
      const roleEmoji = role === 'attacker' ? '🗡️' : '🛡️';

      try {
        await bot.api.sendMessage(
          battle.telegramChatId,
          `${roleEmoji} ${agent.name} (${role}):\n\n${ctx.message.text}`
        );
      } catch (e) {
        console.error('Failed to relay message to group:', e);
      }

      // Process the turn through battle manager
      try {
        await battleManager.processMessage(waiting.battleId, waiting.agentId, ctx.message.text);
      } catch (e) {
        console.error(`Error processing turn:`, e);
        await ctx.reply(`❌ Error processing your turn. Try again.`);
      }
      return;
    }

    // CASE 2: Group chat — check for active battle turns (fallback for non-bot agents)
    const battleId = activeBattlesByChat.get(ctx.chat.id);
    if (!battleId) return;

    const agent = db.getAgentByTelegramId(user.id);
    if (!agent) return;

    const battle = db.getBattle(battleId);
    if (!battle || battle.state !== 'active') return;

    if (battle.activeAgentId !== agent.id) return;

    // Human or non-bot agent playing directly in group
    try {
      await battleManager.processMessage(battleId, agent.id, ctx.message.text);
    } catch (e) {
      console.error(`Error processing turn:`, e);
    }
  });

  return bot;
}
