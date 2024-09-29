import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const kafkaManagerPlugin = createPlugin({
  id: 'kafka-manager',
  routes: {
    root: rootRouteRef,
  },
});

export const KafkaManagerPage = kafkaManagerPlugin.provide(
  createRoutableExtension({
    name: 'KafkaManagerPage',
    component: () =>
      import('./components/ExampleComponent').then(m => m.ExampleComponent),
    mountPoint: rootRouteRef,
  }),
);
