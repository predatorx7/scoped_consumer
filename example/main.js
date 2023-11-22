const { Notifier, Provider, ScopedConsumer } = require("scoped_consumer");

class Counter extends Notifier {
    build() {
        return 0;
    }

    increment() {
        this.state++;
    }

    decrement() {
        this.state--;
    }
}

const counterProvider = new Provider(_ => {
    return new Counter();
});

const main = () => {
    console.log('Creating a scope');

    const scope = new ScopedConsumer();

    console.log('Adding .addListener (listening outside without scope)');
    const listenerRemover = scope.read(counterProvider).addListener((it) => {
        console.log('Counter updated to (.addListener)', it);
    })

    console.log('Adding .listen (listening with scope)');
    scope.listen(counterProvider, (o, n) => {
        console.log('Counter updated to (.listen)', n);
    });

    console.log('incrementing..');
    scope.read(counterProvider).increment();
    console.log('incrementing..');
    scope.read(counterProvider).increment();
    console.log('decrementing..');
    scope.read(counterProvider).decrement();

    console.log('Removing .addListener (listening outside without scope)');
    listenerRemover();

    console.log('incrementing..');
    scope.read(counterProvider).increment();
    console.log('incrementing..');
    scope.read(counterProvider).increment();

    console.log('Current counter value: ', scope.read(counterProvider).state);

    console.log('disposing scope which will remove all listeners withing scope too');
    scope.dispose();
    scope.__remount();

    console.log('incrementing..');
    scope.read(counterProvider).increment();
    console.log('incrementing..');
    scope.read(counterProvider).increment();

    console.log('Current counter value: ', scope.read(counterProvider).state);
};

main();
