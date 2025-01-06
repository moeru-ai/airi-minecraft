export interface TickContext {
  delta: number
  nextTick: () => Promise<void>
}

export interface TickEventHandlers {
  tick: (ctx: TickContext) => void
}

export type TickEvents = keyof TickEventHandlers
export type TickEventsHandler<K extends TickEvents> = TickEventHandlers[K]

// This update loop ensures that each update() is called one at a time, even if it takes longer than the interval
export function createTicker(options?: { interval?: number }) {
  const { interval = 300 } = options ?? { interval: 300 }

  let last = Date.now()
  const tickingCbs: Record<TickEvents, Array<TickEventHandlers[TickEvents]>> = {
    tick: [],
  }

  setTimeout(async () => {
    while (true) {
      const start = Date.now()
      const nextTickPromise = new Promise<void>((resolve) => {
        // Schedule nextTick resolution for after all callbacks complete
        setImmediate(resolve)
      })

      // Run all callbacks without awaiting them
      const callbackPromises = tickingCbs.tick.map(cb => cb({
        delta: start - last,
        nextTick: () => nextTickPromise,
      }))

      // Wait for all callbacks to complete or timeout
      await Promise.race([
        Promise.all(callbackPromises),
        new Promise(resolve =>
          setTimeout(resolve, interval),
        ),
      ])

      const remaining = interval - (Date.now() - start)
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining))
      }

      last = start
    }
  }, interval)

  return {
    on<K extends TickEvents>(event: K, cb: TickEventsHandler<K>) {
      tickingCbs[event].push(cb)
    },
  }
}
