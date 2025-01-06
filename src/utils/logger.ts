import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

export function initLogger() {
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  const logger = useLogg('logger').useGlobalConfig()
  logger.log('Logger initialized')
}
