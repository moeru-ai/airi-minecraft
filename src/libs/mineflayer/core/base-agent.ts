import type { AgentConfig, BaseAgent } from '../interfaces/agents'
import { useLogg } from '@guiiai/logg'
import EventEmitter3 from 'eventemitter3'

export abstract class AbstractAgent extends EventEmitter3 implements BaseAgent {
  public readonly id: string
  public readonly type: AgentConfig['type']
  public readonly name: string

  protected initialized: boolean
  protected logger: ReturnType<typeof useLogg>
  // protected actionManager: ReturnType<typeof useActionManager>
  // protected conversationStore: ReturnType<typeof useConversationStore>

  constructor(config: AgentConfig) {
    super()
    this.id = config.id
    this.type = config.type
    this.name = `${this.type}-${this.id}`
    this.initialized = false
    this.logger = useLogg(this.name).useGlobalConfig()

    // Initialize managers
    // this.actionManager = useActionManager(this)
    // this.conversationStore = useConversationStore({
    //   agent: this,
    //   chatBotMessages: true,
    // })
  }

  public async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.logger.log('Initializing agent')
    await this.initializeAgent()
    this.initialized = true
  }

  public async destroy(): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.logger.log('Destroying agent')
    await this.destroyAgent()
    this.initialized = false
  }

  // Agent interface implementation
  // public isIdle(): boolean {
  //   return !this.actionManager.executing
  // }

  public handleMessage(sender: string, message: string): void {
    this.logger.withFields({ sender, message }).log('Received message')
    this.emit('message', { sender, message })
  }

  public openChat(message: string): void {
    this.logger.withField('message', message).log('Opening chat')
    this.emit('chat', message)
  }

  // public clearBotLogs(): void {
  //   // Implement if needed
  // }

  public requestInterrupt(): void {
    this.emit('interrupt')
  }

  // Methods to be implemented by specific agents
  protected abstract initializeAgent(): Promise<void>
  protected abstract destroyAgent(): Promise<void>
}
