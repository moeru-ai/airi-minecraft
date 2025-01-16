import type { Bot } from 'mineflayer'
import type { Mineflayer } from '../libs/mineflayer/core'
import { useLogg } from '@guiiai/logg'

// Types and interfaces
type ActionFn = (...args: any[]) => void

interface ActionResult {
  success: boolean
  message: string | null
  interrupted: boolean
  timedout: boolean
}

interface BotWithExtensions extends Bot {
  isIdle: () => boolean
  interrupt_code: boolean
  output: string
}

export interface MineflayerWithExtensions extends Mineflayer {
  bot: BotWithExtensions
  self_prompter: {
    on: boolean
  }
  coder: {
    generating: boolean
  }
  clearBotLogs: () => void
  history: {
    add: (source: string, message: string) => void
  }
}

interface ActionState {
  executing: { value: boolean }
  currentActionLabel: { value: string | undefined }
  currentActionFn: { value: ActionFn | undefined }
  timedout: { value: boolean }
  resume: {
    func: { value: ActionFn | undefined }
    name: { value: string | undefined }
  }
}

export function useActionManager(mineflayer: MineflayerWithExtensions) {
  // Initialize state
  const state: ActionState = {
    executing: { value: false },
    currentActionLabel: { value: '' },
    currentActionFn: { value: undefined },
    timedout: { value: false },
    resume: {
      func: { value: undefined },
      name: { value: undefined },
    },
  }

  const log = useLogg('ActionManager').useGlobalConfig()

  // Public API
  async function resumeAction(actionLabel: string, actionFn: ActionFn, timeout: number): Promise<ActionResult> {
    return _executeResume(actionLabel, actionFn, timeout)
  }

  async function runAction(
    actionLabel: string,
    actionFn: ActionFn,
    options: { timeout: number, resume: boolean } = { timeout: 10, resume: false },
  ): Promise<ActionResult> {
    return options.resume
      ? _executeResume(actionLabel, actionFn, options.timeout)
      : _executeAction(actionLabel, actionFn, options.timeout)
  }

  async function stop(): Promise<void> {
    mineflayer.emit('interrupt')
  }

  function cancelResume(): void {
    state.resume.func.value = undefined
    state.resume.name.value = undefined
  }

  // Private helpers
  async function _executeResume(actionLabel?: string, actionFn?: ActionFn, timeout = 10): Promise<ActionResult> {
    const isNewResume = actionFn != null

    if (isNewResume) {
      if (!actionLabel) {
        throw new Error('actionLabel is required for new resume')
      }
      state.resume.func.value = actionFn
      state.resume.name.value = actionLabel
    }

    const canExecute = state.resume.func.value != null
      && (mineflayer.bot.isIdle() || isNewResume)
      && (!mineflayer.self_prompter.on || isNewResume)

    if (!canExecute) {
      return { success: false, message: null, interrupted: false, timedout: false }
    }

    state.currentActionLabel.value = state.resume.name.value
    const result = await _executeAction(state.resume.name.value, state.resume.func.value, timeout)
    state.currentActionLabel.value = ''
    return result
  }

  async function _executeAction(actionLabel?: string, actionFn?: ActionFn, timeout = 10): Promise<ActionResult> {
    let timeoutHandle: NodeJS.Timeout | undefined

    try {
      log.log('executing code...\n')

      if (state.executing.value) {
        log.log(`action "${actionLabel}" trying to interrupt current action "${state.currentActionLabel.value}"`)
      }

      await stop()
      mineflayer.clearBotLogs()

      // Set execution state
      state.executing.value = true
      state.currentActionLabel.value = actionLabel
      state.currentActionFn.value = actionFn

      if (timeout > 0) {
        timeoutHandle = _startTimeout(timeout)
      }

      await actionFn?.()

      // Reset state after successful execution
      _resetExecutionState(timeoutHandle)

      const output = _getBotOutputSummary()
      const interrupted = mineflayer.bot.interrupt_code
      mineflayer.clearBotLogs()

      if (!interrupted && !mineflayer.coder.generating) {
        mineflayer.bot.emit('idle' as any)
      }

      return { success: true, message: output, interrupted, timedout: false }
    }
    catch (err) {
      _resetExecutionState(timeoutHandle)
      cancelResume()
      log.withError(err).error('Code execution triggered catch')
      await stop()

      const message = _formatErrorMessage(err as Error)
      const interrupted = mineflayer.bot.interrupt_code
      mineflayer.clearBotLogs()

      if (!interrupted && !mineflayer.coder.generating) {
        mineflayer.bot.emit('idle' as any)
      }

      return { success: false, message, interrupted, timedout: false }
    }
  }

  function _resetExecutionState(timeoutHandle?: NodeJS.Timeout): void {
    state.executing.value = false
    state.currentActionLabel.value = ''
    state.currentActionFn.value = undefined
    if (timeoutHandle)
      clearTimeout(timeoutHandle)
  }

  function _formatErrorMessage(error: Error): string {
    return `${_getBotOutputSummary()}!!Code threw exception!!\nError: ${error}\nStack trace:\n${error.stack}`
  }

  function _getBotOutputSummary(): string {
    const { bot } = mineflayer
    if (bot.interrupt_code && !state.timedout.value) {
      return ''
    }

    const MAX_OUT = 500
    const output = bot.output.length > MAX_OUT
      ? _truncateOutput(bot.output, MAX_OUT)
      : `Code output:\n${bot.output}`

    return output
  }

  function _truncateOutput(output: string, maxLength: number): string {
    const halfLength = maxLength / 2
    return `Code output is very long (${output.length} chars) and has been shortened.\n
      First outputs:\n${output.substring(0, halfLength)}\n...skipping many lines.\nFinal outputs:\n ${output.substring(output.length - halfLength)}`
  }

  function _startTimeout(timeoutMins = 10): NodeJS.Timeout {
    return setTimeout(async () => {
      log.warn(`Code execution timed out after ${timeoutMins} minutes. Attempting force stop.`)
      state.timedout.value = true
      mineflayer.history.add('system', `Code execution timed out after ${timeoutMins} minutes. Attempting force stop.`)
      await stop()
    }, timeoutMins * 60 * 1000)
  }

  return {
    runAction,
    resumeAction,
    stop,
    cancelResume,
  }
}
