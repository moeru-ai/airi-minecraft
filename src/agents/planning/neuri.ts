import type { Agent } from 'neuri'

import { agent } from 'neuri'

import { useLogger } from '../../utils/logger'

/**
 * Creates a new Neuri agent for planning functionality
 */
export async function createPlanningNeuriAgent(): Promise<Agent> {
  const logger = useLogger()
  logger.log('Initializing planning agent')

  // Create a basic planning agent without tools
  // All planning functionality is handled by the LLMPlanGenerator
  return agent('planning').build()
}
