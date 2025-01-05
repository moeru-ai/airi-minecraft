import process from 'node:process'
import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

import { createBot, useBot } from './bot'
import { createChestComponent } from './components/chest'
import { createEchoComponent } from './components/echo'
import { createFollowComponent } from './components/follow'
import { createPathFinderComponent } from './components/patchfinder'
import { defaultConfig } from './config'

const logger = useLogg('main').useGlobalConfig()

async function main() {
  // await sleep(5000)
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  createBot(defaultConfig)
  const bot = useBot()

  bot.registerComponent('echo', createEchoComponent)
  bot.registerComponent('pathfinder', createPathFinderComponent)
  bot.registerComponent('chest', createChestComponent)
  bot.registerComponent('follow', createFollowComponent)

  process.on('SIGINT', () => {
    bot.cleanup()
    process.exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  process.exit(1)
})
