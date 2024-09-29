import { Config } from '@backstage/config';
import { ClusterDetails, SslConfig, SaslConfig } from '../types/types';

export function getClusterDetails(config: Config[]): ClusterDetails[] {
  return config.map(clusterConfig => {
    const clusterDetails = {
      name: clusterConfig.getString('name'),
      brokers: clusterConfig.getStringArray('brokers'),
    };
    const ssl = clusterConfig.getOptional('ssl') as SslConfig;
    const sasl = clusterConfig.getOptional('sasl') as SaslConfig;

    return {
      ...clusterDetails,
      ...(ssl ? { ssl } : {}),
      ...(sasl ? { sasl } : {}),
    };
  });
}