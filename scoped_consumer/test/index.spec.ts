import { Provider, ScopedConsumer } from '../src';

describe('index', () => {
	describe('Provider', () => {
		it('should return a string containing the message', () => {
			const message = 'Hello';

			const scope = new ScopedConsumer();

			const messageProvider = new Provider<string>(_ => {
				return message;
			});

			const result = scope.read(messageProvider);

			expect(result).toMatch(message);
		});
	});
});
