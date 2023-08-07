import { Notifier, Provider, ScopedConsumer } from ".";

class Counter extends Notifier<number> {
    build(): number {
        return 0;
    }

    increment() {
        this.state++;
    }

    decrement() {
        this.state--;
    }
}

const counterProvider = new Provider((ref) => {
    return new Counter();
});

const main = () => {
    const scope = new ScopedConsumer();

    const rm = scope.read(counterProvider).addListener((it) => {
        console.log('Counter updated to', it);
    })

    scope.read(counterProvider).increment();
    scope.read(counterProvider).increment();
    scope.read(counterProvider).decrement();
    rm();
    scope.read(counterProvider).increment();
    scope.read(counterProvider).increment();
    console.log({
        count: scope.read(counterProvider).state,
    });
};

main();
