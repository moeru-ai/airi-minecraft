import type { Message } from 'neuri/openai'
import type { MemoryAction } from '../../agents/memory'
import type { Action } from './action'

export class Memory {
  public chatHistory: Message[] = []
  public actions: Action[] = []
  public customActions: MemoryAction[] = []

  addAction(action: MemoryAction): void {
    this.customActions.push(action)
  }

  getActions(): MemoryAction[] {
    return this.customActions
  }
}
