import type { Client } from '@proj-airi/server-sdk'
import type { Neuri } from 'neuri'
import type { Mineflayer } from '../../libs/mineflayer'
import type { ActionAgent, ChatAgent, PlanningAgent } from '../../libs/mineflayer/base-agent'

export interface MineflayerWithAgents extends Mineflayer {
  planning: PlanningAgent
  action: ActionAgent
  chat: ChatAgent
}

export interface LLMAgentOptions {
  agent: Neuri
  airiClient: Client
}
