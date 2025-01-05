import { useLogg } from '@guiiai/logg'
import mineflayer, { type Bot, type BotOptions } from 'mineflayer'

export interface Component {
  (bot: Bot): void
}

export interface ComponentContext {
  cleanup: () => void
}

const logger = useLogg('bot').useGlobalConfig()

export function useBot() {
  let botInstance: Bot | null = null
  const contexts = new Map<string, ComponentContext>()

  const createBot = (options: BotOptions): Bot => {
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

  const cleanup = () => {
    logger.log('Cleaning up bot and components')
    contexts.forEach((context: ComponentContext) => context.cleanup?.())
    contexts.clear()
    botInstance?.end()
  }

  const ensureBot = (): Bot => {
    if (!botInstance)
      throw new Error('Bot is not initialized')
    return botInstance
  }

  const registerComponent = (componentName: string, component: Component) => {
    logger.withFields({ componentName }).log('Registering new component')
    const bot = ensureBot()
    const context = component(bot)

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

  return {
    createBot,
    cleanup,
    registerComponent,
    listComponents,
    getComponent,
    getBot: ensureBot,
  }
}
