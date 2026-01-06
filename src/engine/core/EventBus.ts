type Handler = (payload: any) => void;

class EventBus {
    private listeners = new Map<string, Handler[]>();

    public on(event: string, handler: Handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(handler);
    }

    public off(event: string, handler: Handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    public emit(event: string, payload?: any) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach(h => h(payload));
        }
    }
}

export const eventBus = new EventBus();
