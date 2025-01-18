import type { Agent } from './agent'

import { useLogg } from '@guiiai/logg'

type Fn = (...args: any[]) => void

export function useActionManager(agent: Agent) {
  const executing: { value: boolean } = { value: false }
  const currentActionLabel: { value: string | undefined } = { value: '' }
  const currentActionFn: { value: (Fn) | undefined } = { value: undefined }
  const timedout: { value: boolean } = { value: false }
  const resume_func: { value: (Fn) | undefined } = { value: undefined }
  const resume_name: { value: string | undefined } = { value: undefined }
  const log = useLogg('ActionManager').useGlobalConfig()

  async function resumeAction(actionLabel: string, actionFn: Fn, timeout: number) {
    return _executeResume(actionLabel, actionFn, timeout)
  }

  async function runAction(actionLabel: string, actionFn: Fn, options: { timeout: number, resume: boolean } = { timeout: 10, resume: false }) {
    if (options.resume) {
      return _executeResume(actionLabel, actionFn, options.timeout)
    }
    else {
      return _executeAction(actionLabel, actionFn, options.timeout)
    }
  }

  async function stop() {
    if (!executing.value)
      return
    const timeout = setTimeout(() => {
      agent.cleanKill('Code execution refused stop after 10 seconds. Killing process.')
    }, 10000)
    while (executing.value) {
      agent.requestInterrupt()
      log.log('waiting for code to finish executing...')
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    clearTimeout(timeout)
  }

  function cancelResume() {
    resume_func.value = undefined
    resume_name.value = undefined
  }

  async function _executeResume(actionLabel?: string, actionFn?: Fn, timeout = 10) {
    const new_resume = actionFn != null
    if (new_resume) { // start new resume
      resume_func.value = actionFn
      if (actionLabel == null) {
        throw new Error('actionLabel is required for new resume')
      }
      resume_name.value = actionLabel
    }
    if (resume_func.value != null && (agent.isIdle() || new_resume) && (!agent.self_prompter.on || new_resume)) {
      currentActionLabel.value = resume_name.value
      const res = await _executeAction(resume_name.value, resume_func.value, timeout)
      currentActionLabel.value = ''
      return res
    }
    else {
      return { success: false, message: null, interrupted: false, timedout: false }
    }
  }

  async function _executeAction(actionLabel?: string, actionFn?: Fn, timeout = 10) {
    let TIMEOUT
    try {
      log.log('executing code...\n')

      // await current action to finish (executing=false), with 10 seconds timeout
      // also tell agent.bot to stop various actions
      if (executing.value) {
        log.log(`action "${actionLabel}" trying to interrupt current action "${currentActionLabel.value}"`)
      }
      await stop()

      // clear bot logs and reset interrupt code
      agent.clearBotLogs()

      executing.value = true
      currentActionLabel.value = actionLabel
      currentActionFn.value = actionFn

      // timeout in minutes
      if (timeout > 0) {
        TIMEOUT = _startTimeout(timeout)
      }

      // start the action
      await actionFn?.()

      // mark action as finished + cleanup
      executing.value = false
      currentActionLabel.value = ''
      currentActionFn.value = undefined
      clearTimeout(TIMEOUT)

      // get bot activity summary
      const output = _getBotOutputSummary()
      const interrupted = agent.bot.interrupt_code
      agent.clearBotLogs()

      // if not interrupted and not generating, emit idle event
      if (!interrupted && !agent.coder.generating) {
        agent.bot.emit('idle')
      }

      // return action status report
      return { success: true, message: output, interrupted, timedout }
    }
    catch (err) {
      executing.value = false
      currentActionLabel.value = ''
      currentActionFn.value = undefined
      clearTimeout(TIMEOUT)
      cancelResume()
      log.withError(err).error('Code execution triggered catch')
      await stop()

      const message = `${_getBotOutputSummary()
      }!!Code threw exception!!\n`
      + `Error: ${err}\n`
      + `Stack trace:\n${(err as Error).stack}`

      const interrupted = agent.bot.interrupt_code
      agent.clearBotLogs()
      if (!interrupted && !agent.coder.generating) {
        agent.bot.emit('idle')
      }
      return { success: false, message, interrupted, timedout: false }
    }
  }

  function _getBotOutputSummary() {
    const { bot } = agent
    if (bot.interrupt_code && !timedout.value)
      return ''
    let output = bot.output
    const MAX_OUT = 500
    if (output.length > MAX_OUT) {
      output = `Code output is very long (${output.length} chars) and has been shortened.\n
        First outputs:\n${output.substring(0, MAX_OUT / 2)}\n...skipping many lines.\nFinal outputs:\n ${output.substring(output.length - MAX_OUT / 2)}`
    }
    else {
      output = `Code output:\n${output}`
    }

    return output
  }

  function _startTimeout(TIMEOUT_MINS = 10) {
    return setTimeout(async () => {
      log.warn(`Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`)
      timedout.value = true
      agent.history.add('system', `Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`)
      await stop() // last attempt to stop
    }, TIMEOUT_MINS * 60 * 1000)
  }

  return {
    runAction,
    resumeAction,
    stop,
    cancelResume,
  }
}
