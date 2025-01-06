import { messages, system, user } from 'neuri/openai'
import { beforeAll, describe, expect, it } from 'vitest'
import { createBot, useBot } from '../composables/bot'
import { botConfig, initEnv } from '../composables/config'
import { basicSystemPrompt, genQueryAgentPrompt } from '../prompts/agent'
import { initLogger } from '../utils/logger'
import { initAgent } from './openai'

describe('openAI agent', { timeout: 10000 }, () => {
  beforeAll(() => {
    initLogger()
    initEnv()
    createBot(botConfig)
  })

  it('should initialize the agent', async () => {
    const { ctx } = useBot()
    const agent = await initAgent(ctx)

    const text = await agent.handle(
      messages(
        system(basicSystemPrompt('airi')),
        user('Hello, who are you?'),
      ),
      async (c) => {
        const completion = await c.reroute('query', c.messages, { model: 'openai/gpt-4o-mini' })
        return await completion?.firstContent()
      },
    )

    expect(text?.toLowerCase()).toContain('airi')
  })

  it('should choose right command', async () => {
    const { ctx } = useBot()
    const agent = await initAgent(ctx)

    const text = await agent.handle(messages(
      system(genQueryAgentPrompt(ctx)),
      user('What are you status?'),
    ), async (c) => {
      const completion = await c.reroute('query', c.messages, { model: 'openai/gpt-4o-mini' })
      return await completion?.firstContent()
    })

    expect(text?.toLowerCase()).toContain('position')
  })
})
