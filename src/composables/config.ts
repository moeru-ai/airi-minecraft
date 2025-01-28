import type { BotOptions } from 'mineflayer'

import { env } from 'node:process'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('config').useGlobalConfig()

// Configuration interfaces
interface OpenAIConfig {
  apiKey: string
  baseUrl: string
  model: string
  reasoningModel: string
}

interface EnvConfig {
  openai: OpenAIConfig
  bot: BotOptions
}

// Default configurations
const defaultConfig: EnvConfig = {
  openai: {
    apiKey: '',
    baseUrl: '',
    model: '',
    reasoningModel: '',
  },
  bot: {
    username: '',
    host: '',
    port: 0,
    password: '',
    version: '1.20',
  },
}

// Exported configurations
export const botConfig: BotOptions = { ...defaultConfig.bot }
export const openaiConfig: OpenAIConfig = { ...defaultConfig.openai }

// Load environment variables into config
export function initEnv(): void {
  logger.log('Initializing environment variables')

  const config: EnvConfig = {
    openai: {
      apiKey: env.OPENAI_API_KEY || defaultConfig.openai.apiKey,
      baseUrl: env.OPENAI_API_BASEURL || defaultConfig.openai.baseUrl,
      model: env.OPENAI_MODEL || defaultConfig.openai.model,
      reasoningModel: env.OPENAI_REASONING_MODEL || defaultConfig.openai.reasoningModel,
    },
    bot: {
      username: env.BOT_USERNAME || defaultConfig.bot.username,
      host: env.BOT_HOSTNAME || defaultConfig.bot.host,
      port: Number.parseInt(env.BOT_PORT || '49415'),
      password: env.BOT_PASSWORD || defaultConfig.bot.password,
      version: env.BOT_VERSION || defaultConfig.bot.version,
    },
  }

  // Update exported configs
  Object.assign(openaiConfig, config.openai)
  Object.assign(botConfig, config.bot)

  logger.withFields({ openaiConfig }).log('Environment variables initialized')
}
