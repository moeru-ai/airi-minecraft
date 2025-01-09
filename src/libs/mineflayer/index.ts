import type { Bot, BotOptions } from 'mineflayer'
import type { Message } from 'neuri/openai'
import type { z } from 'zod'
import type { MineflayerPlugin } from './plugin'
import { useLogg } from '@guiiai/logg'
import EventEmitter from 'eventemitter3'
import mineflayer from 'mineflayer'
import { type CommandContext, parseCommand } from './command'
import { formBotChat } from './message'
import { Ticker, type TickEvents, type TickEventsHandler } from './ticker'

export interface Context {
  time: number
  command?: CommandContext
}

export interface EventHandlers {
  'command': (ctx: Context) => void | Promise<void>
  'time:sunrise': (ctx: Context) => void
  'time:noon': (ctx: Context) => void
  'time:sunset': (ctx: Context) => void
  'time:midnight': (ctx: Context) => void
}

export type Events = keyof EventHandlers
export type EventsHandler<K extends Events> = EventHandlers[K]

export type Handler = (ctx: Context) => void | Promise<void>

export class Health {
  public value: number
  public lastDamageTime?: number
  public lastDamageTaken?: number

  constructor() {
    this.value = 20
  }
}

abstract class OneLinerable {
  public abstract toOneLiner(): string
}

export class Status implements OneLinerable {
  public position: string
  public health: string
  public weather: string
  public timeOfDay: string

  constructor() {
    this.position = ''
    this.health = ''
    this.weather = ''
    this.timeOfDay = ''
  }

  static from(mineflayer: Mineflayer) {
    const pos = mineflayer.bot.entity.position
    const weather = mineflayer.bot.isRaining ? 'Rain' : mineflayer.bot.thunderState ? 'Thunderstorm' : 'Clear'
    const timeOfDay = mineflayer.bot.time.timeOfDay < 6000
      ? 'Morning'
      : mineflayer.bot.time.timeOfDay < 12000 ? 'Afternoon' : 'Night'

    return {
      position: `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`,
      health: `${Math.round(mineflayer.bot.health)} / 20`,
      weather,
      timeOfDay,
    }
  }

  public toOneLiner(): string {
    return Object.entries(this).map(([key, value]) => `${key}: ${value}`).join('\n')
  }
}

type ActionResult = string | Promise<string>

export interface Action {
  readonly name: string
  readonly description: string
  readonly schema: z.ZodObject<any>
  readonly perform: (mineflayer: Mineflayer) => (...args: any[]) => ActionResult
}

export class Memory {
  public chatHistory: Message[]
  public actions: Action[]

  constructor() {
    this.chatHistory = []
    this.actions = []
  }
}

export class Components {
  private components: Map<string, Handler> = new Map()
  private logger: ReturnType<typeof useLogg>

  constructor() {
    this.logger = useLogg('Components').useGlobalConfig()
  }

  register(componentName: string, component: Handler) {
    this.components.set(componentName, component)
  }

  get(componentName: string) {
    return this.components.get(componentName)
  }

  list() {
    return Array.from(this.components.keys())
  }

  cleanup() {
    this.logger.log('Cleaning up components')
    this.components.clear()
  }
}

export interface MineflayerOptions {
  botConfig: BotOptions
  plugins?: Array<MineflayerPlugin>
}

export class Mineflayer extends EventEmitter<EventHandlers> {
  public bot: Bot
  public username: string
  public health: Health = new Health()
  public ready: boolean = false
  public components: Components = new Components()
  public status: Status = new Status()
  public memory: Memory = new Memory()

  public isCreative: boolean = false
  public shouldInterrupt: boolean = false
  public allowCheats: boolean = false

  private options: MineflayerOptions
  private logger: ReturnType<typeof useLogg>
  private commands: Map<string, EventsHandler<'command'>> = new Map()
  private ticker: Ticker = new Ticker()

  constructor(options: MineflayerOptions) {
    super()
    this.options = options
    this.bot = mineflayer.createBot(options.botConfig)
    this.username = options.botConfig.username
    this.logger = useLogg(`Bot:${this.username}`).useGlobalConfig()
  }

  static async asyncBuild(options: MineflayerOptions) {
    const mineflayer = new Mineflayer(options)

    mineflayer.bot.on('messagestr', async (message, _, jsonMsg) => {
      // jsonMsg.translate:
      // - death.attack.player
      // message:
      // - <bot username> was slain by <player / entity>
      // - <bot username> drowned
      if (jsonMsg.translate && jsonMsg.translate.startsWith('death') && message.startsWith(mineflayer.username)) {
        const deathPos = mineflayer.bot.entity.position

        // mineflayer.memory_bank.rememberPlace('last_death_position', deathPos.x, deathPos.y, deathPos.z)
        let deathPosStr: string | undefined
        if (deathPos) {
          deathPosStr = `x: ${deathPos.x.toFixed(2)}, y: ${deathPos.y.toFixed(2)}, z: ${deathPos.x.toFixed(2)}`
        }

        const dimension = mineflayer.bot.game.dimension
        await mineflayer.handleMessage('system', `You died at position ${deathPosStr || 'unknown'} in the ${dimension} dimension with the final message: '${message}'. Your place of death has been saved as 'last_death_position' if you want to return. Previous actions were stopped and you have re-spawned.`)
      }
    })

    mineflayer.bot.once('resourcePack', () => {
      mineflayer.bot.acceptResourcePack()
    })

    mineflayer.bot.on('time', () => {
      if (mineflayer.bot.time.timeOfDay === 0)
        mineflayer.emit('time:sunrise', { time: mineflayer.bot.time.timeOfDay })
      else if (mineflayer.bot.time.timeOfDay === 6000)
        mineflayer.emit('time:noon', { time: mineflayer.bot.time.timeOfDay })
      else if (mineflayer.bot.time.timeOfDay === 12000)
        mineflayer.emit('time:sunset', { time: mineflayer.bot.time.timeOfDay })
      else if (mineflayer.bot.time.timeOfDay === 18000)
        mineflayer.emit('time:midnight', { time: mineflayer.bot.time.timeOfDay })
    })

    mineflayer.bot.on('health', () => {
      mineflayer.logger.withFields({
        health: mineflayer.health.value,
        lastDamageTime: mineflayer.health.lastDamageTime,
        lastDamageTaken: mineflayer.health.lastDamageTaken,
        previousHealth: mineflayer.bot.health,
      }).log('Health updated')

      if (mineflayer.bot.health < mineflayer.health.value) {
        mineflayer.health.lastDamageTime = Date.now()
        mineflayer.health.lastDamageTaken = mineflayer.health.value - mineflayer.bot.health
      }

      mineflayer.health.value = mineflayer.bot.health
    })

    mineflayer.bot.once('spawn', () => {
      mineflayer.ready = true
      mineflayer.logger.log('Bot ready')
    })

    mineflayer.bot.on('death', () => {
      mineflayer.logger.error('Bot died')
    })

    mineflayer.bot.on('kicked', (reason: string) => {
      mineflayer.logger.withFields({ reason }).error('Bot was kicked')
    })

    mineflayer.bot.on('end', (reason) => {
      mineflayer.logger.withFields({ reason }).log('Bot ended')
    })

    mineflayer.bot.on('error', (err: Error) => {
      mineflayer.logger.errorWithError('Bot error:', err)
    })

    mineflayer.bot.on('spawn', () => {
      mineflayer.bot.on('chat', mineflayer.handleCommand())
    })

    mineflayer.bot.on('spawn', async () => {
      for (const plugin of options?.plugins || []) {
        if (plugin.spawned) {
          await plugin.spawned(mineflayer)
        }
      }
    })

    for (const plugin of options?.plugins || []) {
      if (plugin.created) {
        await plugin.created(mineflayer)
      }
    }

    // Load Plugins
    for (const plugin of options?.plugins || []) {
      if (plugin.loadPlugin) {
        mineflayer.bot.loadPlugin(await plugin.loadPlugin(mineflayer, mineflayer.bot, options.botConfig))
      }
    }

    mineflayer.ticker.on('tick', () => {
      mineflayer.isCreative = mineflayer.bot.game?.gameMode === 'creative'
      mineflayer.allowCheats = false
      mineflayer.shouldInterrupt = false
    })

    return mineflayer
  }

  public async loadPlugin(plugin: MineflayerPlugin) {
    if (plugin.created)
      await plugin.created(this)

    if (plugin.loadPlugin) {
      this.bot.loadPlugin(await plugin.loadPlugin(this, this.bot, this.options.botConfig))
    }

    if (plugin.spawned)
      this.bot.once('spawn', () => plugin.spawned?.(this))
  }

  public onCommand(commandName: string, cb: EventsHandler<'command'>) {
    this.commands.set(commandName, cb)
  }

  public onTick(event: TickEvents, cb: TickEventsHandler<TickEvents>) {
    this.ticker.on(event, cb)
  }

  public emit<E extends Events>(event: E, ...args: Parameters<EventsHandler<E>>) {
    return super.emit(event, ...args)
  }

  public async stop() {
    for (const plugin of this.options?.plugins || []) {
      if (plugin.beforeCleanup) {
        await plugin.beforeCleanup(this)
      }
    }
    this.components.cleanup()
    this.bot.removeListener('chat', this.handleCommand())
    this.bot.end()
    this.removeAllListeners()
  }

  private handleCommand() {
    return formBotChat(this.username, (sender, message) => {
      const { isCommand, command, args } = parseCommand(sender, message)

      if (!isCommand)
        return

      // Remove the # prefix from command
      const cleanCommand = command.slice(1)
      this.logger.withFields({ sender, command: cleanCommand, args }).log('Command received')

      const handler = this.commands.get(cleanCommand)
      if (handler) {
        handler({ time: this.bot.time.timeOfDay, command: { sender, isCommand, command: cleanCommand, args } })
        return
      }

      // Built-in commands
      switch (cleanCommand) {
        case 'help': {
          const commandList = Array.from(this.commands.keys()).concat(['help'])
          this.bot.chat(`Available commands: ${commandList.map(cmd => `#${cmd}`).join(', ')}`)
          break
        }
        default:
          this.bot.chat(`Unknown command: ${cleanCommand}`)
      }
    })
  }

  private async handleMessage(_source: string, _message: string, _maxResponses: number = Infinity) {
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
}
