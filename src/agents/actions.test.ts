import { messages, system, user } from 'neuri/openai'
import { beforeAll, describe, expect, it } from 'vitest'
import { initBot, useBot } from '../composables/bot'
import { botConfig, initEnv } from '../composables/config'
import { genActionAgentPrompt, genQueryAgentPrompt } from '../prompts/agent'
import { sleep } from '../utils/helper'
import { initLogger } from '../utils/logger'
import { initAgent } from './openai'

describe('actions agent', { timeout: 0 }, () => {
  beforeAll(() => {
    initLogger()
    initEnv()
    initBot({ botConfig })
  })

  it('should choose right query command', async () => {
    const { bot } = useBot()
    const agent = await initAgent(bot)

    await new Promise<void>((resolve) => {
      bot.bot.once('spawn', async () => {
        const text = await agent.handle(messages(
          system(genQueryAgentPrompt(bot)),
          user('What are you status?'),
        ), async (c) => {
          const completion = await c.reroute('query', c.messages, { model: 'openai/gpt-4o-mini' })
          console.log(JSON.stringify(completion, null, 2))
          return await completion?.firstContent()
        })

        expect(text?.toLowerCase()).toContain('position')

        resolve()
      })
    })
  })

  it('should choose right action command', async () => {
    const { bot } = useBot()
    const agent = await initAgent(bot)

    // console.log(JSON.stringify(agent, null, 2))

    await new Promise<void>((resolve) => {
      bot.bot.on('spawn', async () => {
        const text = await agent.handle(messages(
          system(genActionAgentPrompt(bot)),
          user('goToPlayer: luoling8192'),
        ), async (c) => {
          console.log(JSON.stringify(c, null, 2))

          const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' })

          console.log(JSON.stringify(completion, null, 2))

          return await completion?.firstContent()
        })

        console.log(JSON.stringify(text, null, 2))

        await sleep(10000)
        resolve()
      })
    })
  })

  // it('should split question into actions', async () => {
  //   const { ctx } = useBot()
  //   const agent = await initAgent(ctx)

  //   function testFn() {
  //     return new Promise<void>((resolve) => {
  //       ctx.bot.on('spawn', async () => {
  //         const text = await agent.handle(messages(
  //           system(genActionAgentPrompt(ctx)),
  //           user('Help me to cut down the tree'),
  //         ), async (c) => {
  //           const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' })

  //           console.log(completion)

  //           return await completion?.firstContent()
  //         })

  //         console.log(text)

  //         resolve()
  //       })
  //     })
  //   }

  //   await testFn()
  // })
})
