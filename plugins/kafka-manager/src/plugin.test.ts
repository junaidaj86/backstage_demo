import { kafkaManagerPlugin } from './plugin';

describe('kafka-manager', () => {
  it('should export plugin', () => {
    expect(kafkaManagerPlugin).toBeDefined();
  });
});
