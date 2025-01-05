import type { BotOptions } from 'mineflayer'
import process from 'node:process'
import { useLogg } from '@guiiai/logg'
import { configDotenv } from 'dotenv'

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
}

export const openaiConfig: OpenAIConfig = {
  apiKey: '',
  baseUrl: '',
}

export function initEnv() {
  logger.log('Initializing environment variables')

  configDotenv({ path: '.env.local' })
  openaiConfig.apiKey = process.env.OPENAI_API_KEY || ''
  openaiConfig.baseUrl = process.env.OPENAI_API_BASEURL || ''

  botConfig.username = process.env.BOT_USERNAME || ''
  botConfig.host = process.env.BOT_HOSTNAME || ''
  botConfig.port = Number.parseInt(process.env.BOT_PORT || '49415')
  botConfig.password = process.env.BOT_PASSWORD || ''

  logger.withFields({ openaiConfig }).log('Environment variables initialized')
}
