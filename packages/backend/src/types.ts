// File: packages/backend/src/types.ts
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import { DiscoveryApi } from '@backstage/core-plugin-api';

export interface PluginEnvironment {
  logger: Logger;
  config: Config;
  discovery: DiscoveryApi;
}

export interface KubernetesEnvironment extends PluginEnvironment {
  catalogApi: any; // Use 'any' for now if not available directly
  permissions: any;
}
