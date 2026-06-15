type EventMap = {
  'note:created': { id: string }
  'note:saved': { id: string }
  'note:deleted': { id: string }
  'note:opened-external': { id: string }
  'app:shown': undefined
  'app:hidden': undefined
  'settings:changed': undefined
}

type Handler<T> = (payload: T) => void

const handlers = new Map<keyof EventMap, Set<Handler<never>>>()

export const eventBus = {
  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>) {
    const set = handlers.get(event) ?? new Set<Handler<never>>()
    set.add(handler as Handler<never>)
    handlers.set(event, set)
    return () => set.delete(handler as Handler<never>)
  },

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    handlers.get(event)?.forEach((handler) => handler(payload as never))
  },
}
