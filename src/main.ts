import process, { exit } from 'node:process'

import { useLogg } from '@guiiai/logg'
import { Client } from '@proj-airi/server-sdk'
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
    ],
  })

  const airiClient = new Client({ name: 'minecraft-bot', url: 'ws://localhost:6121/ws' })

  // Dynamically load LLMAgent after bot is initialized
  const agent = await initAgent(bot)
  await bot.loadPlugin(LLMAgent({ agent, airiClient }))

  process.on('SIGINT', () => {
    bot.stop()
    exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  exit(1)
})
