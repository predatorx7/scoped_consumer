export interface Ref {
    read<T>(provider: ProviderBase<T>): T;
}

export type ProviderCallback<T> = (ref: Ref) => T;

export interface ProviderBase<T> {
    readonly callback: ProviderCallback<T>;
    readonly debugLabel?: string;
}

export class Provider<T> implements ProviderBase<T> {
    constructor(readonly callback: ProviderCallback<T>, readonly debugLabel?: string) {

    }
}

export class ScopedRef<O> implements Ref {
    constructor(private readonly scoped: ScopedConsumer, private readonly owner: ProviderBase<O>) { }

    read<T>(provider: ProviderBase<T>): T {
        return this.scoped.read(provider);
    };

    onCreate(cb: () => void) { }

    onDispose(cb: () => void) { }
}

export type STATE_MAP = { [key: number]: any };
export type CHILDREN = { [key: number]: ProviderBase<any>[] };
export type STATE_RESULT = { index: number, state: STATE_MAP, children: ProviderBase<any>[] };

export class ScopedConsumer {
    constructor(protected readonly parent?: ScopedConsumer) { }

    private providers: ProviderBase<any>[] = [];
    private state: STATE_MAP = {};
    private children: CHILDREN = {};

    protected findProviderState<T>(provider: ProviderBase<T>): STATE_RESULT | null {
        if (!this.providers.includes(provider)) {
            if (this.parent) {
                return this.parent.findProviderState(provider);
            }
            return null;
        } else {
            const index = this.providers.indexOf(provider);
            if (!this.children[index]) {
                this.children[index] = [];
            }
            return {
                index: index,
                state: this.state,
                children: this.children[index],
            }
        }
    }

    protected createState<T>(provider: ProviderBase<T>): STATE_RESULT {
        if (!this.providers.includes(provider)) {
            this.providers.push(provider);
        }
        const index = this.providers.indexOf(provider);
        if (!this.children[index]) {
            this.children[index] = [];
        }
        return {
            index: index,
            state: this.state,
            children: this.children[index],
        }
    }

    protected hasCreatedState(stateResult: STATE_RESULT): boolean {
        return !!stateResult.state[stateResult.index];
    }

    protected getState<T>(provider: ProviderBase<T>): STATE_RESULT {
        let stateResult = this.findProviderState(provider);
        if (!stateResult) {
            stateResult = this.createState(provider);
        }
        return stateResult;
    }

    read<T>(provider: ProviderBase<T>): T {
        let stateResult = this.getState(provider);

        if (!this.hasCreatedState(stateResult)) {
            stateResult.state[stateResult.index] = provider.callback(new ScopedRef(this, provider))
        }
        return stateResult.state[stateResult.index] as T;
    }

    invalidate<T>(provider: ProviderBase<T>): void {
        let stateResult = this.getState(provider);
        if (this.hasCreatedState(stateResult)) {
            stateResult.state[stateResult.index] = null;
        }
    }

    child() {
        return new ScopedConsumer(this);
    }

    dispose() {
        //
    }

    async run(callback: (consumer: ScopedConsumer) => Promise<void>) {
        const consumer = this.child();
        await callback(consumer);
        consumer.dispose();
    }
}
