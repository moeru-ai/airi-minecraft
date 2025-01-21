// import { useLogg } from '@guiiai/logg'

// let self_prompter_paused = false

// interface ConversationMessage {
//   message: string
//   start: boolean
//   end: boolean
// }

// function compileInMessages(inQueue: ConversationMessage[]) {
//   let pack: ConversationMessage | undefined
//   let fullMessage = ''
//   while (inQueue.length > 0) {
//     pack = inQueue.shift()
//     if (!pack)
//       continue

//     fullMessage += pack.message
//   }
//   if (pack) {
//     pack.message = fullMessage
//   }

//   return pack
// }

// type Conversation = ReturnType<typeof useConversations>

// function useConversations(name: string, agent: Agent) {
//   const active = { value: false }
//   const ignoreUntilStart = { value: false }
//   const blocked = { value: false }
//   let inQueue: ConversationMessage[] = []
//   const inMessageTimer: { value: NodeJS.Timeout | undefined } = { value: undefined }

//   function reset() {
//     active.value = false
//     ignoreUntilStart.value = false
//     inQueue = []
//   }

//   function end() {
//     active.value = false
//     ignoreUntilStart.value = true
//     const fullMessage = compileInMessages(inQueue)
//     if (!fullMessage)
//       return

//     if (fullMessage.message.trim().length > 0) {
//       agent.history.add(name, fullMessage.message)
//     }

//     if (agent.lastSender === name) {
//       agent.lastSender = undefined
//     }
//   }

//   function queue(message: ConversationMessage) {
//     inQueue.push(message)
//   }

//   return {
//     reset,
//     end,
//     queue,
//     name,
//     inMessageTimer,
//     blocked,
//     active,
//     ignoreUntilStart,
//     inQueue,
//   }
// }

// const WAIT_TIME_START = 30000

// export type ConversationStore = ReturnType<typeof useConversationStore>

// export function useConversationStore(options: { agent: Agent, chatBotMessages?: boolean, agentNames?: string[] }) {
//   const conversations: Record<string, Conversation> = {}
//   const activeConversation: { value: Conversation | undefined } = { value: undefined }
//   const awaitingResponse = { value: false }
//   const waitTimeLimit = { value: WAIT_TIME_START }
//   const connectionMonitor: { value: NodeJS.Timeout | undefined } = { value: undefined }
//   const connectionTimeout: { value: NodeJS.Timeout | undefined } = { value: undefined }
//   const agent = options.agent
//   let agentsInGame = options.agentNames || []
//   const log = useLogg('ConversationStore').useGlobalConfig()

//   const conversationStore = {
//     getConvo: (name: string) => {
//       if (!conversations[name])
//         conversations[name] = useConversations(name, agent)
//       return conversations[name]
//     },
//     startMonitor: () => {
//       clearInterval(connectionMonitor.value)
//       let waitTime = 0
//       let lastTime = Date.now()
//       connectionMonitor.value = setInterval(() => {
//         if (!activeConversation.value) {
//           conversationStore.stopMonitor()
//           return // will clean itself up
//         }

//         const delta = Date.now() - lastTime
//         lastTime = Date.now()
//         const convo_partner = activeConversation.value.name

//         if (awaitingResponse.value && agent.isIdle()) {
//           waitTime += delta
//           if (waitTime > waitTimeLimit.value) {
//             agent.handleMessage('system', `${convo_partner} hasn't responded in ${waitTimeLimit.value / 1000} seconds, respond with a message to them or your own action.`)
//             waitTime = 0
//             waitTimeLimit.value *= 2
//           }
//         }
//         else if (!awaitingResponse.value) {
//           waitTimeLimit.value = WAIT_TIME_START
//           waitTime = 0
//         }

//         if (!conversationStore.otherAgentInGame(convo_partner) && !connectionTimeout.value) {
//           connectionTimeout.value = setTimeout(() => {
//             if (conversationStore.otherAgentInGame(convo_partner)) {
//               conversationStore.clearMonitorTimeouts()
//               return
//             }
//             if (!self_prompter_paused) {
//               conversationStore.endConversation(convo_partner)
//               agent.handleMessage('system', `${convo_partner} disconnected, conversation has ended.`)
//             }
//             else {
//               conversationStore.endConversation(convo_partner)
//             }
//           }, 10000)
//         }
//       }, 1000)
//     },
//     stopMonitor: () => {
//       clearInterval(connectionMonitor.value)
//       connectionMonitor.value = undefined
//       conversationStore.clearMonitorTimeouts()
//     },
//     clearMonitorTimeouts: () => {
//       awaitingResponse.value = false
//       clearTimeout(connectionTimeout.value)
//       connectionTimeout.value = undefined
//     },
//     startConversation: (send_to: string, message: string) => {
//       const convo = conversationStore.getConvo(send_to)
//       convo.reset()

//       if (agent.self_prompter.on) {
//         agent.self_prompter.stop()
//         self_prompter_paused = true
//       }
//       if (convo.active.value)
//         return

//       convo.active.value = true
//       activeConversation.value = convo
//       conversationStore.startMonitor()
//       conversationStore.sendToBot(send_to, message, true, false)
//     },
//     startConversationFromOtherBot: (name: string) => {
//       const convo = conversationStore.getConvo(name)
//       convo.active.value = true
//       activeConversation.value = convo
//       conversationStore.startMonitor()
//     },
//     sendToBot: (send_to: string, message: string, start = false, open_chat = true) => {
//       if (!conversationStore.isOtherAgent(send_to)) {
//         console.warn(`${agent.name} tried to send bot message to non-bot ${send_to}`)
//         return
//       }
//       const convo = conversationStore.getConvo(send_to)

//       if (options.chatBotMessages && open_chat)
//         agent.openChat(`(To ${send_to}) ${message}`)

//       if (convo.ignoreUntilStart.value)
//         return
//       convo.active.value = true

//       const end = message.includes('!endConversation')
//       const json = {
//         message,
//         start,
//         end,
//       }

//       awaitingResponse.value = true
//       // TODO:
//       // sendBotChatToServer(send_to, json)
//       log.withField('json', json).log(`Sending message to ${send_to}`)
//     },
//     receiveFromBot: async (sender: string, received: ConversationMessage) => {
//       const convo = conversationStore.getConvo(sender)

//       if (convo.ignoreUntilStart.value && !received.start)
//         return

//       // check if any convo is active besides the sender
//       if (conversationStore.inConversation() && !conversationStore.inConversation(sender)) {
//         conversationStore.sendToBot(sender, `I'm talking to someone else, try again later. !endConversation("${sender}")`, false, false)
//         conversationStore.endConversation(sender)
//         return
//       }

//       if (received.start) {
//         convo.reset()
//         conversationStore.startConversationFromOtherBot(sender)
//       }

//       conversationStore.clearMonitorTimeouts()
//       convo.queue(received)

//       // responding to conversation takes priority over self prompting
//       if (agent.self_prompter.on) {
//         await agent.self_prompter.stopLoop()
//         self_prompter_paused = true
//       }

//       _scheduleProcessInMessage(agent, conversationStore, sender, received, convo)
//     },
//     responseScheduledFor: (sender: string) => {
//       if (!conversationStore.isOtherAgent(sender) || !conversationStore.inConversation(sender))
//         return false
//       const convo = conversationStore.getConvo(sender)
//       return !!convo.inMessageTimer
//     },
//     isOtherAgent: (name: string) => {
//       return !!options.agentNames?.includes(name)
//     },
//     otherAgentInGame: (name: string) => {
//       return agentsInGame.includes(name)
//     },
//     updateAgents: (agents: Agent[]) => {
//       options.agentNames = agents.map(a => a.name)
//       agentsInGame = agents.filter(a => a.in_game).map(a => a.name)
//     },
//     getInGameAgents: () => {
//       return agentsInGame
//     },
//     inConversation: (other_agent?: string) => {
//       if (other_agent)
//         return conversations[other_agent]?.active
//       return Object.values(conversations).some(c => c.active)
//     },
//     endConversation: (sender: string) => {
//       if (conversations[sender]) {
//         conversations[sender].end()
//         if (activeConversation.value?.name === sender) {
//           conversationStore.stopMonitor()
//           activeConversation.value = undefined
//           if (self_prompter_paused && !conversationStore.inConversation()) {
//             _resumeSelfPrompter(agent, conversationStore)
//           }
//         }
//       }
//     },
//     endAllConversations: () => {
//       for (const sender in conversations) {
//         conversationStore.endConversation(sender)
//       }
//       if (self_prompter_paused) {
//         _resumeSelfPrompter(agent, conversationStore)
//       }
//     },
//     forceEndCurrentConversation: () => {
//       if (activeConversation.value) {
//         const sender = activeConversation.value.name
//         conversationStore.sendToBot(sender, `!endConversation("${sender}")`, false, false)
//         conversationStore.endConversation(sender)
//       }
//     },
//     scheduleSelfPrompter: () => {
//       self_prompter_paused = true
//     },
//     cancelSelfPrompter: () => {
//       self_prompter_paused = false
//     },
//   }

//   return conversationStore
// }

// function containsCommand(message: string) {
//   // TODO: mock
//   return message
// }

// /*
// This function controls conversation flow by deciding when the bot responds.
// The logic is as follows:
// - If neither bot is busy, respond quickly with a small delay.
// - If only the other bot is busy, respond with a long delay to allow it to finish short actions (ex check inventory)
// - If I'm busy but other bot isn't, let LLM decide whether to respond
// - If both bots are busy, don't respond until someone is done, excluding a few actions that allow fast responses
// - New messages received during the delay will reset the delay following this logic, and be queued to respond in bulk
// */
// const talkOverActions = ['stay', 'followPlayer', 'mode:'] // all mode actions
// const fastDelay = 200
// const longDelay = 5000

// async function _scheduleProcessInMessage(agent: Agent, conversationStore: ConversationStore, sender: string, received: { message: string, start: boolean }, convo: Conversation) {
//   if (convo.inMessageTimer)
//     clearTimeout(convo.inMessageTimer.value)
//   const otherAgentBusy = containsCommand(received.message)

//   const scheduleResponse = (delay: number) => convo.inMessageTimer.value = setTimeout(() => _processInMessageQueue(agent, conversationStore, sender), delay)

//   if (!agent.isIdle() && otherAgentBusy) {
//     // both are busy
//     const canTalkOver = talkOverActions.some(a => agent.actions.currentActionLabel.includes(a))
//     if (canTalkOver)
//       scheduleResponse(fastDelay)
//     // otherwise don't respond
//   }
//   else if (otherAgentBusy) {
//     // other bot is busy but I'm not
//     scheduleResponse(longDelay)
//   }
//   else if (!agent.isIdle()) {
//     // I'm busy but other bot isn't
//     const canTalkOver = talkOverActions.some(a => agent.actions.currentActionLabel.includes(a))
//     if (canTalkOver) {
//       scheduleResponse(fastDelay)
//     }
//     else {
//       const shouldRespond = await agent.prompter.promptShouldRespondToBot(received.message)
//       useLogg('Conversation').useGlobalConfig().log(`${agent.name} decided to ${shouldRespond ? 'respond' : 'not respond'} to ${sender}`)
//       if (shouldRespond)
//         scheduleResponse(fastDelay)
//     }
//   }
//   else {
//     // neither are busy
//     scheduleResponse(fastDelay)
//   }
// }

// function _processInMessageQueue(agent: Agent, conversationStore: ConversationStore, name: string) {
//   const convo = conversationStore.getConvo(name)
//   _handleFullInMessage(agent, conversationStore, name, compileInMessages(convo.inQueue))
// }

// function _handleFullInMessage(agent: Agent, conversationStore: ConversationStore, sender: string, received: ConversationMessage | undefined) {
//   if (!received)
//     return

//   useLogg('Conversation').useGlobalConfig().log(`${agent.name} responding to "${received.message}" from ${sender}`)

//   const convo = conversationStore.getConvo(sender)
//   convo.active.value = true

//   let message = _tagMessage(received.message)
//   if (received.end) {
//     conversationStore.endConversation(sender)
//     message = `Conversation with ${sender} ended with message: "${message}"`
//     sender = 'system' // bot will respond to system instead of the other bot
//   }
//   else if (received.start) {
//     agent.shut_up = false
//   }
//   convo.inMessageTimer.value = undefined
//   agent.handleMessage(sender, message)
// }

// function _tagMessage(message: string) {
//   return `(FROM OTHER BOT)${message}`
// }

// async function _resumeSelfPrompter(agent: Agent, conversationStore: ConversationStore) {
//   await new Promise(resolve => setTimeout(resolve, 5000))
//   if (self_prompter_paused && !conversationStore.inConversation()) {
//     self_prompter_paused = false
//     agent.self_prompter.start()
//   }
// }
