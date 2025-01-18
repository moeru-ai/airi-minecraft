import type { Mineflayer } from '../libs/mineflayer/core'

import { useLogg } from '@guiiai/logg'
import EventEmitter from 'eventemitter3'

// Types and interfaces
type ActionFn = (...args: any[]) => void

interface ActionResult {
  success: boolean
  message: string | null
  timedout: boolean
}

interface QueuedAction {
  label: string
  fn: ActionFn
  timeout: number
  resume: boolean
}

export class ActionManager extends EventEmitter {
  private state = {
    executing: false,
    currentActionLabel: '',
    currentActionFn: undefined as ActionFn | undefined,
    timedout: false,
    resume: {
      func: undefined as ActionFn | undefined,
      name: undefined as string | undefined,
    },
  }

  // Action queue to store pending actions
  private actionQueue: QueuedAction[] = []

  private logger = useLogg('ActionManager').useGlobalConfig()
  private mineflayer: Mineflayer

  constructor(mineflayer: Mineflayer) {
    super()
    this.mineflayer = mineflayer
  }

  public async resumeAction(actionLabel: string, actionFn: ActionFn, timeout: number): Promise<ActionResult> {
    return this.queueAction({
      label: actionLabel,
      fn: actionFn,
      timeout,
      resume: true,
    })
  }

  public async runAction(
    actionLabel: string,
    actionFn: ActionFn,
    options: { timeout: number, resume: boolean } = { timeout: 10, resume: false },
  ): Promise<ActionResult> {
    return this.queueAction({
      label: actionLabel,
      fn: actionFn,
      timeout: options.timeout,
      resume: options.resume,
    })
  }

  public async stop(): Promise<void> {
    this.mineflayer.emit('interrupt')
    // Clear the action queue when stopping
    this.actionQueue = []
  }

  public cancelResume(): void {
    this.state.resume.func = undefined
    this.state.resume.name = undefined
  }

  private async queueAction(action: QueuedAction): Promise<ActionResult> {
    // Add action to queue
    this.actionQueue.push(action)

    // If not executing, start processing queue
    if (!this.state.executing) {
      return this.processQueue()
    }

    // Return a promise that will resolve when the action is executed
    return new Promise((resolve) => {
      const checkQueue = setInterval(() => {
        const index = this.actionQueue.findIndex(a => a === action)
        if (index === -1) {
          clearInterval(checkQueue)
          resolve({ success: true, message: 'success', timedout: false })
        }
      }, 100)
    })
  }

  private async processQueue(): Promise<ActionResult> {
    while (this.actionQueue.length > 0) {
      const action = this.actionQueue[0]

      const result = action.resume
        ? await this.executeResume(action.label, action.fn, action.timeout)
        : await this.executeAction(action.label, action.fn, action.timeout)

      // Remove completed action from queue
      this.actionQueue.shift()

      if (!result.success) {
        // Clear queue on failure
        this.actionQueue = []
        return result
      }
    }

    return { success: true, message: 'success', timedout: false }
  }

  private async executeResume(actionLabel?: string, actionFn?: ActionFn, timeout = 10): Promise<ActionResult> {
    const isNewResume = actionFn != null

    if (isNewResume) {
      if (!actionLabel) {
        throw new Error('actionLabel is required for new resume')
      }
      this.state.resume.func = actionFn
      this.state.resume.name = actionLabel
    }

    const canExecute = this.state.resume.func != null && isNewResume

    if (!canExecute) {
      return { success: false, message: null, timedout: false }
    }

    this.state.currentActionLabel = this.state.resume.name || ''
    const result = await this.executeAction(this.state.resume.name || '', this.state.resume.func, timeout)
    this.state.currentActionLabel = ''
    return result
  }

  private async executeAction(actionLabel: string, actionFn?: ActionFn, timeout = 10): Promise<ActionResult> {
    let timeoutHandle: NodeJS.Timeout | undefined

    try {
      this.logger.log('executing action...\n')

      if (this.state.executing) {
        this.logger.log(`action "${actionLabel}" trying to interrupt current action "${this.state.currentActionLabel}"`)
      }

      await this.stop()

      // Set execution state
      this.state.executing = true
      this.state.currentActionLabel = actionLabel
      this.state.currentActionFn = actionFn

      if (timeout > 0) {
        timeoutHandle = this.startTimeout(timeout)
      }

      await actionFn?.()

      // Reset state after successful execution
      this.resetExecutionState(timeoutHandle)

      return { success: true, message: 'success', timedout: false }
    }
    catch (err) {
      this.resetExecutionState(timeoutHandle)
      this.cancelResume()
      this.logger.withError(err).error('Code execution triggered catch')
      await this.stop()

      return { success: false, message: 'failed', timedout: false }
    }
  }

  private resetExecutionState(timeoutHandle?: NodeJS.Timeout): void {
    this.state.executing = false
    this.state.currentActionLabel = ''
    this.state.currentActionFn = undefined
    if (timeoutHandle)
      clearTimeout(timeoutHandle)
  }

  private startTimeout(timeoutMins = 10): NodeJS.Timeout {
    return setTimeout(async () => {
      this.logger.warn(`Code execution timed out after ${timeoutMins} minutes. Attempting force stop.`)
      this.state.timedout = true
      this.emit('timeout', `Code execution timed out after ${timeoutMins} minutes. Attempting force stop.`)
      await this.stop()
    }, timeoutMins * 60 * 1000)
  }
}
