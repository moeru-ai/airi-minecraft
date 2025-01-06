import { describe, expect, it } from 'vitest'

import { initQueryAgent } from './openai'

describe('openAI agent', () => {
  it('should initialize the agent', () => {
    const agent = initQueryAgent()
    expect(agent).toBeDefined()
  })
})
