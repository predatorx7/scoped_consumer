export interface Ref {
	read<T>(provider: ProviderBase<T>): T;

	listen<STATE>(
		provider: ProviderBase<Notifier<STATE>>,
		onChange: ListenerChangeCallback<STATE>,
		fireImmediately?: boolean
	): void;

	onDispose(cb: VoidCallback): void;
}

export type ProviderCallback<T> = (ref: Ref) => T;

export interface ProviderBase<T> {
	readonly callback: ProviderCallback<T>;
	readonly debugLabel?: string;
}

export class Provider<T> implements ProviderBase<T> {
	constructor(
		readonly callback: ProviderCallback<T>,
		readonly debugLabel?: string
	) {}
}

export class ScopedRef<O> implements Ref {
	constructor(
		private readonly scoped: ScopedConsumer,
		private readonly owner: ProviderBase<O>
	) {}

	read<T>(provider: ProviderBase<T>): T {
		return this.scoped.read(provider);
	}

	listen<STATE>(
		provider: ProviderBase<Notifier<STATE>>,
		onChange: ListenerChangeCallback<STATE>,
		fireImmediately?: boolean
	) {
		return this.scoped.listen(provider, onChange, fireImmediately);
	}

	onCreate(cb: VoidCallback) {}

	onDispose(cb: VoidCallback) {
		return this.scoped.onDispose(cb);
	}
}

export type STATE_MAP = { [key: number]: any };
export type CHILDREN = { [key: number]: ProviderBase<any>[] };
export type STATE_RESULT = {
	index: number;
	state: STATE_MAP;
	children: ProviderBase<any>[];
};

export type ListenerChangeCallback<STATE> = (
	oldState: STATE | null,
	newState: STATE
) => void;

export class InvalidScopedConsumerUsage {
	constructor(private readonly message: string) {}

	toString() {
		return `InvalidScopedConsumerUsage: ${this.message}`;
	}
}

export class ScopedConsumer {
	constructor(protected readonly parent?: ScopedConsumer) {}

	private providers: ProviderBase<any>[] = [];
	private state: STATE_MAP = {};
	private children: CHILDREN = {};
	private disposeCallbacks: VoidCallback[] = [];

	private _mounted = true;
	public get mounted() {
		return this._mounted;
	}

	private throwIfUnmounted() {
		if (this.mounted) return;
		throw new InvalidScopedConsumerUsage(
			'A scoped consumer was used after it was disposed.'
		);
	}

	protected findProviderState<T>(
		provider: ProviderBase<T>
	): STATE_RESULT | null {
		this.throwIfUnmounted();
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
			};
		}
	}

	protected createState<T>(provider: ProviderBase<T>): STATE_RESULT {
		this.throwIfUnmounted();
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
		};
	}

	protected hasCreatedState(stateResult: STATE_RESULT): boolean {
		this.throwIfUnmounted();
		return !!stateResult.state[stateResult.index];
	}

	protected getState<T>(provider: ProviderBase<T>): STATE_RESULT {
		this.throwIfUnmounted();
		let stateResult = this.findProviderState(provider);
		if (!stateResult) {
			stateResult = this.createState(provider);
		}
		return stateResult;
	}

	onDispose(cb: VoidCallback) {
		this.throwIfUnmounted();
		this.disposeCallbacks.push(cb);
	}

	read<T>(provider: ProviderBase<T>): T {
		this.throwIfUnmounted();
		let stateResult = this.getState(provider);

		if (!this.hasCreatedState(stateResult)) {
			stateResult.state[stateResult.index] = provider.callback(
				new ScopedRef(this, provider)
			);
		}
		return stateResult.state[stateResult.index] as T;
	}

	listen<STATE>(
		provider: ProviderBase<Notifier<STATE>>,
		onChange: ListenerChangeCallback<STATE>,
		fireImmediately?: boolean
	) {
		this.throwIfUnmounted();
		const notifier = this.read(provider);

		let oldValue = notifier.state;
		const listenerRemover = notifier.addListener(value => {
			onChange(oldValue, value);
			oldValue = value;
		}, fireImmediately);

		this.onDispose(listenerRemover);
	}

	invalidate<T>(provider: ProviderBase<T>): void {
		this.throwIfUnmounted();
		let stateResult = this.getState(provider);
		if (this.hasCreatedState(stateResult)) {
			stateResult.state[stateResult.index] = null;
		}
	}

	child() {
		this.throwIfUnmounted();
		const child = new ScopedConsumer(this);

		this.onDispose(() => {
			child.dispose();
		});

		return child;
	}

	__remount() {
		this._mounted = true;
	}

	dispose() {
		if (!this.mounted) return;
		for (let index = 0; index < this.disposeCallbacks.length; index++) {
			const cb = this.disposeCallbacks[index];
			cb();
		}
		this._mounted = false;
	}

	async run(callback: (consumer: ScopedConsumer) => Promise<void>) {
		if (!this.mounted) return;
		const consumer = this.child();
		await callback(consumer);
		consumer.dispose();
	}
}

export type ValueChanged<T> = (value: T) => void;
export type VoidCallback = () => void;

export abstract class Notifier<STATE> {
	private _listeners: ValueChanged<STATE>[] = [];

	private _internalState?: STATE;

	get state(): STATE {
		if (!this._didInitialize) {
			this._internalState = this.build();
			this._didInitialize = true;
		}
		return this._internalState!;
	}

	private _didInitialize = false;

	build(): STATE {
		return this._internalState!;
	}

	set state(state: STATE) {
		const oldState = this._internalState;
		this._internalState = state;
		if (this.updateShouldNotify(oldState, state)) {
			this.notifiyListeners();
		}
	}

	private notifiyListeners(): void {
		const state = this.state;
		for (let index = 0; index < this._listeners.length; index++) {
			const cb = this._listeners[index];
			cb(state);
		}
	}

	updateShouldNotify(
		oldState: STATE | undefined | null,
		newState: STATE
	): boolean {
		return oldState !== newState;
	}

	addListener(
		cb: ValueChanged<STATE>,
		fireImmediately = false
	): VoidCallback {
		if (!this._listeners.includes(cb)) {
			this._listeners.push(cb);
		}
		if (fireImmediately) {
			cb(this.state);
		}

		// Returning listener remover
		return () => {
			const i = this._listeners.indexOf(cb);
			if (i < 0) return;
			this._listeners.splice(i, 1);
		};
	}
}
