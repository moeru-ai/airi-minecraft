// import type { ActionLLMHandler } from '../agents/action/llm-handler'
// import type { PlanningLLMHandler } from '../agents/planning/llm-handler'
// import type { Mineflayer } from '../libs/mineflayer/core'

// import { useLogg } from '@guiiai/logg'
// import EventEmitter from 'eventemitter3'

// import { actionsList } from '../agents/action/tools'

// interface PlanExecutionResult {
//   success: boolean
//   message: string
//   step: number
//   totalSteps: number
// }

// export class PlanManager extends EventEmitter {
//   private logger = useLogg('PlanManager').useGlobalConfig()
//   private mineflayer: Mineflayer
//   private planningHandler: PlanningLLMHandler
//   private actionHandler: ActionLLMHandler

//   constructor(
//     mineflayer: Mineflayer,
//     planningHandler: PlanningLLMHandler,
//     actionHandler: ActionLLMHandler,
//   ) {
//     super()
//     this.mineflayer = mineflayer
//     this.planningHandler = planningHandler
//     this.actionHandler = actionHandler
//   }

//   /**
//    * Execute a plan to achieve a goal
//    * @param goal The goal to achieve
//    * @returns The result of the plan execution
//    */
//   public async executePlan(goal: string): Promise<PlanExecutionResult> {
//     try {
//       // Generate plan
//       this.logger.log('Generating plan for goal:', goal)
//       const plan = await this.planningHandler.generatePlan(goal, Object.values(actionsList))

//       // Execute each step
//       let currentStep = 0
//       for (const step of plan) {
//         currentStep++
//         this.logger.log(`Executing step ${currentStep}/${plan.length}:`, step.description)

//         try {
//           const result = await this.actionHandler.executeStep(step)
//           this.logger.log('Step result:', result)
//         }
//         catch (error) {
//           // If a step fails, try to regenerate the plan with feedback
//           this.logger.error('Step failed:', error)
//           const feedback = `Failed at step ${currentStep}: ${error.message}`
//           return this.retryWithFeedback(goal, feedback)
//         }
//       }

//       return {
//         success: true,
//         message: 'Plan executed successfully',
//         step: plan.length,
//         totalSteps: plan.length,
//       }
//     }
//     catch (error) {
//       this.logger.error('Plan execution failed:', error)
//       return {
//         success: false,
//         message: error.message,
//         step: 0,
//         totalSteps: 0,
//       }
//     }
//   }

//   /**
//    * Retry executing the plan with feedback from previous failure
//    */
//   private async retryWithFeedback(
//     goal: string,
//     feedback: string,
//   ): Promise<PlanExecutionResult> {
//     this.logger.log('Retrying with feedback:', feedback)
//     const plan = await this.planningHandler.generatePlan(
//       goal,
//       Object.values(actionsList),
//       feedback,
//     )

//     // Execute the new plan
//     return this.executePlan(goal)
//   }
// }
