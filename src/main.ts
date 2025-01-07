import process, { exit } from 'node:process'

import { useLogg } from '@guiiai/logg'

import { initAgent } from './agents/openai'
import { createAiChatComponent } from './components/aichat'
import { createCommandComponent } from './components/command'
import { createFollowComponent } from './components/follow'
import { createPathFinderComponent } from './components/pathfinder'
import { createStatusComponent } from './components/status'
import { createBot, useBot } from './composables/bot'
import { botConfig, initEnv } from './composables/config'
import { initLogger } from './utils/logger'
import { createTicker } from './utils/ticker'

const logger = useLogg('main').useGlobalConfig()

async function main() {
  initLogger()
  initEnv()

  createBot(botConfig)
  const { cleanup, registerComponent, ctx } = useBot()

  ctx.bot.once('spawn', () => {
    registerComponent('status', createStatusComponent)
    // registerComponent('echo', createEchoComponent)
    registerComponent('pathfinder', createPathFinderComponent)
    registerComponent('follow', createFollowComponent)
    registerComponent('command', createCommandComponent)
    registerComponent('aichat', createAiChatComponent)
  })

  await initAgent(ctx)

  const ticker = createTicker()
  ticker.on('tick', async ({ delta }) => {
    // logger.log(`Tick ${delta}ms`)
  })

  process.on('SIGINT', () => {
    cleanup()
    exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  exit(1)
})
