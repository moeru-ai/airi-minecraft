import type { BotOptions } from 'mineflayer'

import { env } from 'node:process'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('config').useGlobalConfig()

interface OpenAIConfig {
  apiKey: string
  baseUrl: string
}

export const botConfig: BotOptions = {
  username: '',
  host: '',
  port: 0,
  password: '',
  version: '1.20',
}

export const openaiConfig: OpenAIConfig = {
  apiKey: '',
  baseUrl: '',
}

export function initEnv() {
  logger.log('Initializing environment variables')

  openaiConfig.apiKey = env.OPENAI_API_KEY || ''
  openaiConfig.baseUrl = env.OPENAI_API_BASEURL || ''

  botConfig.username = env.BOT_USERNAME || ''
  botConfig.host = env.BOT_HOSTNAME || ''
  botConfig.port = Number.parseInt(env.BOT_PORT || '49415')
  botConfig.password = env.BOT_PASSWORD || ''
  botConfig.version = env.BOT_VERSION || '1.20'

  logger.withFields({ openaiConfig }).log('Environment variables initialized')
}
