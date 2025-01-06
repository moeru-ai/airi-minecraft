import { messages, system, user } from 'neuri/openai'
import { beforeAll, describe, it } from 'vitest'
import { createBot, useBot } from '../composables/bot'
import { botConfig, initEnv } from '../composables/config'
import { genActionAgentPrompt } from '../prompts/agent'
import { initLogger } from '../utils/logger'
import { initAgent } from './openai'

describe('actions agent', { timeout: 0 }, () => {
  beforeAll(() => {
    initLogger()
    initEnv()
    createBot(botConfig)
  })

  it('should split question into actions', async () => {
    const { ctx } = useBot()
    const agent = await initAgent(ctx)

    function testFn() {
      return new Promise<void>((resolve) => {
        ctx.bot.on('spawn', async () => {
          const text = await agent.handle(messages(
            system(genActionAgentPrompt(ctx)),
            user('Help me to cut down the tree'),
          ), async (c) => {
            const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' })

            console.log(completion)

            return await completion?.firstContent()
          })

          console.log(text)

          resolve()
        })
      })
    }

    await testFn()
  })
})
