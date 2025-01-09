import process, { exit } from 'node:process'

import { useLogg } from '@guiiai/logg'
import MineflayerArmorManager from 'mineflayer-armor-manager'
import { loader as MineflayerAutoEat } from 'mineflayer-auto-eat'
import { plugin as MineflayerCollectBlock } from 'mineflayer-collectblock'
import { pathfinder as MineflayerPathfinder } from 'mineflayer-pathfinder'
import { plugin as MineflayerPVP } from 'mineflayer-pvp'
import { plugin as MineflayerTool } from 'mineflayer-tool'

import { initAgent } from './agents/openai'
import { initBot } from './composables/bot'
import { botConfig, initEnv } from './composables/config'
import { wrapPlugin } from './libs/mineflayer/plugin'
import { FollowCommand, PathFinder, Status } from './mineflayer'
import { LLMAgent } from './mineflayer/llm-agent'
import { initLogger } from './utils/logger'

const logger = useLogg('main').useGlobalConfig()

async function main() {
  initLogger() // todo: save logs to file
  initEnv()

  const { bot } = await initBot({
    botConfig,
    plugins: [
      wrapPlugin(MineflayerArmorManager),
      wrapPlugin(MineflayerAutoEat),
      wrapPlugin(MineflayerCollectBlock),
      wrapPlugin(MineflayerPathfinder),
      wrapPlugin(MineflayerPVP),
      wrapPlugin(MineflayerTool),
      FollowCommand(),
      Status(),
      PathFinder(),
    ],
  })

  // Dynamically load LLMAgent after bot is initialized
  // const llmAgent = LLMAgent({
  //   agent: async () => await initAgent(bot),
  // })

  // if (llmAgent.created)
  //   await llmAgent.created(bot)
  // if (llmAgent.spawned)
  //   bot.bot.once('spawn', () => llmAgent.spawned?.(bot))
  // if (llmAgent.loadPlugin)
  //   bot.bot.loadPlugin(await llmAgent.loadPlugin(bot, bot.bot, botConfig))
  const agent = await initAgent(bot)
  await bot.loadPlugin(LLMAgent({ agent }))

  process.on('SIGINT', () => {
    bot.stop()
    exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  exit(1)
})
