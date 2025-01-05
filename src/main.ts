import process from 'node:process'
import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import { useBot } from './bot'
import { createEchoComponent } from './components/echo'
import { createPathFinderComponent } from './components/patchfinder'
import { defaultConfig } from './config'

const logger = useLogg('main').useGlobalConfig()

async function main() {
  // await sleep(5000)
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  const bot = useBot()
  bot.createBot(defaultConfig)

  bot.registerComponent('echo', createEchoComponent)
  bot.registerComponent('pathfinder', createPathFinderComponent)

  process.on('SIGINT', () => {
    bot.cleanup()
    process.exit(0)
  })
}

main().catch((err: Error) => {
  logger.errorWithError('Fatal error', err)
  process.exit(1)
})
