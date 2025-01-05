import { useLogg } from '@guiiai/logg'
import mineflayer, { type Bot, type BotOptions } from 'mineflayer'

const logger = useLogg('bot').useGlobalConfig()

let botInstance: Bot | undefined

export interface Component {
  (bot: Bot): void
}

export interface ComponentLifecycle {
  cleanup: () => void
}

export function createBot(options: BotOptions): Bot {
  logger.withFields({ options }).log('Creating bot')
  botInstance = mineflayer.createBot({
    host: options.host,
    port: options.port,
    username: options.username,
    password: options.password,
  })

  botInstance.on('error', (err: Error) => {
    logger.errorWithError('Bot error:', err)
  })

  botInstance.on('kicked', (reason: string) => {
    logger.withFields({ reason }).error('Bot was kicked')
  })

  logger.log('Bot created')
  return botInstance
}

export function useBot() {
  const contexts = new Map<string, ComponentLifecycle>()

  const cleanup = () => {
    logger.log('Cleaning up bot and components')
    contexts.forEach((context: ComponentLifecycle) => context.cleanup?.())
    contexts.clear()
    botInstance?.end()
  }

  const registerComponent = (componentName: string, component: Component) => {
    logger.withFields({ componentName }).log('Registering new component')
    const context = component(botInstance!)

    if (context != null)
      contexts.set(componentName, context)

    return context
  }

  const listComponents = () => {
    return Array.from(contexts.keys())
  }

  const getComponent = (componentName: string) => {
    return contexts.get(componentName)
  }

  if (!botInstance) {
    throw new Error('Bot instance not found')
  }

  return {
    registerComponent,
    listComponents,
    getComponent,
    cleanup,
    bot: botInstance,
  }
}
