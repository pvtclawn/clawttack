// src/bot/index.ts — Telegram bot for Agent Arena

import { Bot, Context, session } from 'grammy';
import type { ArenaDB } from '../db/index.ts';
import type { BattleManager, BattleEvents } from '../services/battle-manager.ts';
import type { Agent, Battle, BattleOutcome, TurnResult } from '../types/scenario.ts';
import { listScenarios } from '../scenarios/registry.ts';

interface BotDeps {
  db: ArenaDB;
  battleManager: BattleManager;
  botToken: string;
}

// Track which chat each battle is happening in, and which battles each agent is in
const activeBattlesByChat = new Map<number, string>(); // chatId → battleId
const pendingChallenges = new Map<string, {
  challengerId: string;
  challengerAgent: Agent;
  scenarioId: string;
  chatId: number;
  expiresAt: number;
}>(); // challengeId → challenge info

export function createBattleEvents(bot: Bot): BattleEvents {
  return {
    onBattleCreated(battle: Battle) {
      // Nothing to announce yet
    },

    async onBattleStarted(battle: Battle, roleInstructions: Map<string, string>) {
      // Send role instructions privately to each agent
      for (const agent of battle.agents) {
        const instructions = roleInstructions.get(agent.id);
        if (instructions) {
          try {
            await bot.api.sendMessage(agent.telegramUserId, instructions, { parse_mode: 'Markdown' });
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
        `⚔️ **BATTLE STARTED!**`,
        ``,
        `🗡️ Attacker: ${attacker?.name ?? 'Unknown'}`,
        `🛡️ Defender: ${defender?.name ?? 'Unknown'}`,
        ``,
        `📋 Scenario: Injection CTF`,
        `🔄 Max turns: ${battle.maxTurns}`,
        `🔐 Secret hash: \`${battle.commitment?.slice(0, 16)}...\``,
        ``,
        `${attacker?.name}, you go first! Extract the secret phrase. 🎯`,
      ].join('\n');

      try {
        await bot.api.sendMessage(battle.telegramChatId, announcement, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Failed to announce battle start:', e);
      }
    },

    async onTurnProcessed(battle: Battle, result: TurnResult) {
      if (result.announcement && battle.telegramChatId) {
        try {
          await bot.api.sendMessage(battle.telegramChatId, result.announcement, { parse_mode: 'Markdown' });
        } catch (e) {
          console.error('Failed to send turn announcement:', e);
        }
      }

      if (result.action === 'continue' && result.nextAgentId) {
        const nextAgent = battle.agents.find(a => a.id === result.nextAgentId);
        if (nextAgent) {
          try {
            await bot.api.sendMessage(
              battle.telegramChatId,
              `⏳ Turn ${battle.currentTurn}/${battle.maxTurns} — ${nextAgent.name}'s turn`,
            );
          } catch (e) {
            console.error('Failed to send turn indicator:', e);
          }
        }
      }
    },

    async onBattleEnded(battle: Battle, outcome: BattleOutcome) {
      activeBattlesByChat.delete(battle.telegramChatId);

      const winner = battle.agents.find(a => a.id === outcome.winnerId);
      const loser = battle.agents.find(a => a.id === outcome.loserId);

      const summary = [
        `🏆 **BATTLE RESULTS**`,
        ``,
        winner ? `👑 Winner: **${winner.name}**` : `🤝 Draw!`,
        loser ? `💀 Loser: ${loser.name}` : '',
        ``,
        `📝 ${outcome.reason}`,
        outcome.verified ? `✅ Cryptographically verified` : `⚠️ Unverified`,
        ``,
        `Turns: ${battle.turns.length}`,
        `Duration: ${battle.endedAt && battle.startedAt ? Math.round((battle.endedAt - battle.startedAt) / 60) : '?'} minutes`,
      ].filter(Boolean).join('\n');

      try {
        await bot.api.sendMessage(battle.telegramChatId, summary, { parse_mode: 'Markdown' });
      } catch (e) {
        console.error('Failed to send battle results:', e);
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
        `⚔️ **Agent Arena** — AI agents battle each other!`,
        ``,
        `Commands:`,
        `/register — Register as a fighter`,
        `/challenge — Challenge another agent`,
        `/accept — Accept a challenge`,
        `/status — Your battle stats`,
        `/leaderboard — Top fighters`,
        `/scenarios — List available battle types`,
        `/cancel — Cancel current battle`,
        ``,
        `How it works:`,
        `1. Two agents register`,
        `2. One challenges the other`,
        `3. Bot assigns roles and starts the battle`,
        `4. Agents take turns in the chat`,
        `5. Winner determined by scenario rules`,
        ``,
        `🔐 Outcomes are cryptographically verified!`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
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

    await ctx.reply(`✅ Registered! You're now **${name}** (ID: ${agentId})\n\nChallenge someone with /challenge`, {
      parse_mode: 'Markdown',
    });
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
      scenarioId: 'injection-ctf', // Default scenario for now
      chatId: ctx.chat.id,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
    });

    await ctx.reply(
      [
        `⚔️ **CHALLENGE ISSUED!**`,
        ``,
        `${challengerAgent.name} challenges ${targetAgent.name}!`,
        `Scenario: 🔐 Injection CTF`,
        ``,
        `${targetAgent.name}, reply with /accept to fight!`,
        ``,
        `_Challenge expires in 5 minutes_`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
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
    let foundChallenge: { id: string; challengerId: string; challengerAgent: Agent; scenarioId: string } | null = null;

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
      // Create and start the battle
      const battle = await battleManager.createBattle(
        foundChallenge.scenarioId,
        [foundChallenge.challengerAgent, acceptorAgent],
      );

      activeBattlesByChat.set(ctx.chat.id, battle.id);

      await ctx.reply('🔥 Challenge accepted! Setting up the battle...');

      // Start the battle in this chat
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

    // Get full agent record from DB
    const agentId = `tg:${user.id}`;
    const row = db.getAgent(agentId);

    await ctx.reply(
      [
        `📊 **${agent.name}** Stats`,
        ``,
        `🏆 Record: queried from DB`,
        `📈 Elo: 1200 (starting)`,
        ``,
        `Use /leaderboard to see rankings!`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
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

    await ctx.reply(`🏆 **Leaderboard**\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  });

  bot.command('scenarios', async (ctx) => {
    const scenarios = listScenarios();
    const lines = scenarios.map(s => `• **${s.name}** — ${s.description}`);
    await ctx.reply(`📋 **Available Scenarios**\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
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

    await battleManager.cancelBattle(battle.id, `Cancelled by ${agent.name}`);
    activeBattlesByChat.delete(battle.telegramChatId);
    await ctx.reply(`❌ Battle cancelled by ${agent.name}.`);
  });

  // --- Message handler: process battle turns ---

  bot.on('message:text', async (ctx) => {
    const user = ctx.from;
    if (!user || !ctx.chat) return;

    // Check if there's an active battle in this chat
    const battleId = activeBattlesByChat.get(ctx.chat.id);
    if (!battleId) return; // Not a battle chat, ignore

    const agent = db.getAgentByTelegramId(user.id);
    if (!agent) return; // Not a registered agent

    const battle = db.getBattle(battleId);
    if (!battle || battle.state !== 'active') return;

    // Check if it's this agent's turn
    if (battle.activeAgentId !== agent.id) {
      // Silently ignore — it's not their turn
      return;
    }

    try {
      await battleManager.processMessage(battleId, agent.id, ctx.message.text);
    } catch (e) {
      console.error(`Error processing turn:`, e);
    }
  });

  return bot;
}
