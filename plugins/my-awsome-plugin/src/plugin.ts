import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const myAwsomePluginPlugin = createPlugin({
  id: 'my-awsome-plugin',
  routes: {
    root: rootRouteRef,
  },
});

export const MyAwsomePluginPage = myAwsomePluginPlugin.provide(
  createRoutableExtension({
    name: 'MyAwsomePluginPage',
    component: () =>
      import('./components/ExampleComponent').then(m => m.ExampleComponent),
    mountPoint: rootRouteRef,
  }),
);
