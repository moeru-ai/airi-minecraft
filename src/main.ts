import process from 'node:process'

import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

import { initAgent } from './agents/openai'
import { createCommandComponent } from './components/command'
import { createFollowComponent } from './components/follow'
import { createPathFinderComponent } from './components/pathfinder'
import { createStatusComponent } from './components/status'
import { createBot, useBot } from './composables/bot'
import { botConfig, initEnv } from './composables/config'

const logger = useLogg('main').useGlobalConfig()

async function main() {
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  initEnv()

  createBot(botConfig)
  const { cleanup, registerComponent, ctx } = useBot()

  ctx.bot.once('spawn', () => {
    registerComponent('status', createStatusComponent)
    // registerComponent('echo', createEchoComponent)
    registerComponent('pathfinder', createPathFinderComponent)
    registerComponent('follow', createFollowComponent)
    registerComponent('command', createCommandComponent)
  })

  initAgent()

  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  process.exit(1)
})
