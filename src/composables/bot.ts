import type { BotInternalEventHandlers, BotInternalEvents } from './events'
import { useLogg } from '@guiiai/logg'
import mineflayer, { type Bot, type BotOptions } from 'mineflayer'

const logger = useLogg('bot').useGlobalConfig()

let ctx: BotContext | undefined

export interface BotContext {
  bot: Bot
  botName: string
  ready: boolean

  components: Map<string, ComponentLifecycle>

  prompt: {
    selfPrompt: string
  }

  memory: {
    getSummary: () => string
  }

  status: Map<string, string>
  // status: {
  //   position: Position
  //   health: number
  //   weather: string
  //   timeOfDay: string
  // }

  health: {
    value: number
    lastDamageTime: number
    lastDamageTaken: number
  }

  emit: (event: BotInternalEvents) => any
  eventListeners: Record<BotInternalEvents, Array<BotInternalEventHandlers[BotInternalEvents]>>
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
    ready: false,
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
    status: new Map(),
    health: {
      value: 20,
      lastDamageTime: 0,
      lastDamageTaken: 0,
    },
    emit: (event: BotInternalEvents) => {
      if (!ctx)
        return
      const listeners = ctx.eventListeners[event]
      if (listeners) {
        listeners.forEach(listener => listener())
      }
    },
    eventListeners: {
      'time:sunrise': [],
      'time:noon': [],
      'time:sunset': [],
      'time:midnight': [],
    },
  }

  ctx.bot.on('time', () => {
    if (!ctx)
      return

    if (ctx.bot.time.timeOfDay === 0)
      ctx.emit('time:sunrise')
    else if (ctx.bot.time.timeOfDay === 6000)
      ctx.emit('time:noon')
    else if (ctx.bot.time.timeOfDay === 12000)
      ctx.emit('time:sunset')
    else if (ctx.bot.time.timeOfDay === 18000)
      ctx.emit('time:midnight')
  })

  ctx.bot.on('health', () => {
    if (!ctx)
      return

    logger.withFields({
      health: ctx.health.value,
      lastDamageTime: ctx.health.lastDamageTime,
      lastDamageTaken: ctx.health.lastDamageTaken,
      previousHealth: ctx.bot.health,
    }).log('Health updated')

    if (ctx.bot.health < ctx.health.value) {
      ctx.health.lastDamageTime = Date.now()
      ctx.health.lastDamageTaken = ctx.health.value - ctx.bot.health
    }

    ctx.health.value = ctx.bot.health
  })

  ctx.bot.once('spawn', () => {
    ctx!.ready = true
    logger.log('Bot ready')
  })

  ctx.bot.on('death', () => {
    logger.error('Bot died')
  })

  ctx.bot.on('messagestr', async (message, _, jsonMsg) => {
    if (!ctx)
      return

    // jsonMsg.translate:
    // - death.attack.player
    // message:
    // - <bot username> was slain by <player / entity>
    // - <bot username> drowned
    if (jsonMsg.translate && jsonMsg.translate.startsWith('death') && message.startsWith(ctx.botName)) {
      const deathPos = ctx.bot.entity.position

      // this.memory_bank.rememberPlace('last_death_position', deathPos.x, deathPos.y, deathPos.z)
      let deathPosStr: string | undefined
      if (deathPos) {
        deathPosStr = `x: ${deathPos.x.toFixed(2)}, y: ${deathPos.y.toFixed(2)}, z: ${deathPos.x.toFixed(2)}`
      }

      const dimension = ctx.bot.game.dimension
      await handleMessage(ctx, 'system', `You died at position ${deathPosStr || 'unknown'} in the ${dimension} dimension with the final message: '${message}'. Your place of death has been saved as 'last_death_position' if you want to return. Previous actions were stopped and you have re-spawned.`)
    }
  })

  ctx.bot.on('end', (reason) => {
    logger.withFields({ reason }).log('Bot ended')
  })

  ctx.bot.on('kicked', (reason: string) => {
    logger.withFields({ reason }).error('Bot was kicked')
  })

  ctx.bot.on('error', (err: Error) => {
    logger.errorWithError('Bot error:', err)
  })

  logger.log('Bot created')
  return ctx.bot
}

async function handleMessage(ctx: BotContext, source: string, message: string, maxResponses: number = Infinity) {
  // if (!source || !message) {
  //     console.warn('Received empty message from', source);
  //     return false;
  // }

  // let used_command = false;
  // if (maxResponses === null) {
  //     maxResponses = settings.max_commands === -1 ? Infinity : settings.max_commands;
  // }
  // if (maxResponses === -1) {
  //     maxResponses = Infinity;
  // }

  // const self_prompt = source === 'system' || source === ctx.botName;
  // const from_other_bot = convoManager.isOtherAgent(source);

  // if (!self_prompt && !from_other_bot) { // from user, check for forced commands
  //     const user_command_name = containsCommand(message);
  //     if (user_command_name) {
  //         if (!commandExists(user_command_name)) {
  //             this.routeResponse(source, `Command '${user_command_name}' does not exist.`);
  //             return false;
  //         }
  //         this.routeResponse(source, `*${source} used ${user_command_name.substring(1)}*`);
  //         if (user_command_name === '!newAction') {
  //             // all user-initiated commands are ignored by the bot except for this one
  //             // add the preceding message to the history to give context for newAction
  //             this.history.add(source, message);
  //         }
  //         let execute_res = await executeCommand(this, message);
  //         if (execute_res)
  //             this.routeResponse(source, execute_res);
  //         return true;
  //     }
  // }

  // if (from_other_bot)
  //     this.last_sender = source;

  // // Now translate the message
  // message = await handleEnglishTranslation(message);
  // console.log('received message from', source, ':', message);

  // const checkInterrupt = () => this.self_prompter.shouldInterrupt(self_prompt) || this.shut_up || convoManager.responseScheduledFor(source);

  // let behavior_log = this.bot.modes.flushBehaviorLog();
  // if (behavior_log.trim().length > 0) {
  //     const MAX_LOG = 500;
  //     if (behavior_log.length > MAX_LOG) {
  //         behavior_log = '...' + behavior_log.substring(behavior_log.length - MAX_LOG);
  //     }
  //     behavior_log = 'Recent behaviors log: \n' + behavior_log.substring(behavior_log.indexOf('\n'));
  //     await this.history.add('system', behavior_log);
  // }

  // // Handle other user messages
  // await this.history.add(source, message);
  // this.history.save();

  // if (!self_prompt && this.self_prompter.on) // message is from user during self-prompting
  //     maxResponses = 1; // force only respond to this message, then let self-prompting take over
  // for (let i=0; i<maxResponses; i++) {
  //     if (checkInterrupt()) break;
  //     let history = this.history.getHistory();
  //     let res = await this.prompter.promptConvo(history);

  //     console.log(`${this.name} full response to ${source}: ""${res}""`);

  //     if (res.trim().length === 0) {
  //         console.warn('no response')
  //         break; // empty response ends loop
  //     }

  //     let command_name = containsCommand(res);

  //     if (command_name) { // contains query or command
  //         res = truncCommandMessage(res); // everything after the command is ignored
  //         this.history.add(this.name, res);

  //         if (!commandExists(command_name)) {
  //             this.history.add('system', `Command ${command_name} does not exist.`);
  //             console.warn('Agent hallucinated command:', command_name)
  //             continue;
  //         }

  //         if (checkInterrupt()) break;
  //         this.self_prompter.handleUserPromptedCmd(self_prompt, isAction(command_name));

  //         if (settings.verbose_commands) {
  //             this.routeResponse(source, res);
  //         }
  //         else { // only output command name
  //             let pre_message = res.substring(0, res.indexOf(command_name)).trim();
  //             let chat_message = `*used ${command_name.substring(1)}*`;
  //             if (pre_message.length > 0)
  //                 chat_message = `${pre_message}  ${chat_message}`;
  //             this.routeResponse(source, chat_message);
  //         }

  //         let execute_res = await executeCommand(this, res);

  //         console.log('Agent executed:', command_name, 'and got:', execute_res);
  //         used_command = true;

  //         if (execute_res)
  //             this.history.add('system', execute_res);
  //         else
  //             break;
  //     }
  //     else { // conversation response
  //         this.history.add(this.name, res);
  //         this.routeResponse(source, res);
  //         break;
  //     }

  //     this.history.save();
  // }

  // return used_command;
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
