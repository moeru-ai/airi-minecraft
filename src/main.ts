import process from 'node:process'
import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

import { createBot, useBot } from './bot'
import { createChestComponent } from './components/chest'
import { createEchoComponent } from './components/echo'
import { createFollowComponent } from './components/follow'
import { createPathFinderComponent } from './components/patchfinder'
import { botConfig, initEnv } from './config'

const logger = useLogg('main').useGlobalConfig()

async function main() {
  // await sleep(5000)
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  initEnv()

  createBot(botConfig)
  const { cleanup, registerComponent } = useBot()

  registerComponent('echo', createEchoComponent)
  registerComponent('pathfinder', createPathFinderComponent)
  registerComponent('chest', createChestComponent)
  registerComponent('follow', createFollowComponent)

  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  process.exit(1)
})
