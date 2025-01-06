import { useLogg } from '@guiiai/logg'
import mineflayer, { type Bot, type BotOptions } from 'mineflayer'

const logger = useLogg('bot').useGlobalConfig()

let ctx: BotContext | undefined

export interface BotContext {
  bot: Bot
  components: Map<string, ComponentLifecycle>

  botName: string
  prompt: {
    selfPrompt: string
  }
  memory: {
    getSummary: () => string
  }
}

export interface Component {
  (ctx: BotContext): ComponentLifecycle
}

export interface ComponentLifecycle {
  cleanup: () => void
}

export function createBot(options: BotOptions): Bot {
  logger.withFields({ options }).log('Creating bot')
  ctx = {
    bot: mineflayer.createBot({
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
    }),
    components: new Map(),
    botName: options.username,
    prompt: {
      selfPrompt: '',
    },
    memory: {
      getSummary: () => '',
    },
  }

  ctx.bot.on('error', (err: Error) => {
    logger.errorWithError('Bot error:', err)
  })

  ctx.bot.on('kicked', (reason: string) => {
    logger.withFields({ reason }).error('Bot was kicked')
  })

  logger.log('Bot created')
  return ctx.bot
}

export function useBot() {
  if (ctx == null || ctx.bot == null) {
    throw new Error('Bot instance not found')
  }

  const cleanup = () => {
    logger.log('Cleaning up bot and components')
    ctx!.components.forEach((BotContext: ComponentLifecycle) => BotContext.cleanup?.())
    ctx!.components.clear()
    ctx!.bot.end()
  }

  const registerComponent = (componentName: string, component: Component) => {
    logger.withFields({ componentName }).log('Registering new component')
    const BotContext = component(ctx!)

    if (BotContext != null)
      ctx!.components.set(componentName, BotContext)

    return BotContext
  }

  const listComponents = () => {
    return Array.from(ctx!.components.keys())
  }

  const getComponent = (componentName: string) => {
    return ctx!.components.get(componentName)
  }

  return {
    ctx,
    registerComponent,
    listComponents,
    getComponent,
    cleanup,
  }
}
