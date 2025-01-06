import { useLogg } from '@guiiai/logg'
import { messages, system, user } from 'neuri/openai'

import { beforeAll, describe, expect, it } from 'vitest'
import { initEnv } from '../composables/config'
import { basicSystemPrompt } from '../prompts/agent'
import { initLogger } from '../utils/logger'
import { initAgent } from './openai'

describe('openAI agent', () => {
  beforeAll(() => {
    initLogger()
    initEnv()
  })

  it('should initialize the agent', async () => {
    const agent = await initAgent()

    const text = await agent.handle(
      messages(
        system(basicSystemPrompt('airi')),
        user('Hello, who are you?'),
      ),
      async (c) => {
        const completion = await c.reroute('query', c.messages, { model: 'gpt-4o-mini' })
        return await completion?.firstContent()
      },
    )

    expect(text?.toLowerCase()).toContain('airi')
  })
})
