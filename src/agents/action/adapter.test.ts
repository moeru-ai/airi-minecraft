import { messages, system, user } from 'neuri/openai'
import { beforeAll, describe, expect, it } from 'vitest'

import { initBot, useBot } from '../../composables/bot'
import { botConfig, initEnv, openaiConfig } from '../../composables/config'
import { createNeuriAgent } from '../../composables/neuri'
import { initLogger } from '../../utils/logger'
import { generateSystemBasicPrompt } from '../prompt/llm-agent'

describe('openAI agent', { timeout: 0 }, () => {
  beforeAll(() => {
    initLogger()
    initEnv()
    initBot({ botConfig })
  })

  it('should initialize the agent', async () => {
    const { bot } = useBot()
    const agent = await createNeuriAgent(bot)

    await new Promise<void>((resolve) => {
      bot.bot.once('spawn', async () => {
        const text = await agent.handle(
          messages(
            system(generateSystemBasicPrompt('airi')),
            user('Hello, who are you?'),
          ),
          async (c) => {
            const completion = await c.reroute('query', c.messages, { model: openaiConfig.model })
            return await completion?.firstContent()
          },
        )

        expect(text?.toLowerCase()).toContain('airi')

        resolve()
      })
    })
  })
})
