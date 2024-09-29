import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { Kafka } from 'kafkajs';
import { KafkaApi, KafkaJsApiImpl } from './KafkaApi';
import { getClusterDetails } from '../config/ClusterReader';
import _ from 'lodash';
import { NotFoundError } from '@backstage/errors';

export interface RouterOptions {
  logger: LoggerService;
  config: RootConfigService;
}

export interface ClusterApi {
  name: string;
  api: KafkaApi;
}

/** @public */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const logger = options.logger;

  logger.info('Initializing Kafka backend');

  const clientId = options.config.getString('kafka.clientId');

  const clusters = getClusterDetails(
    options.config.getConfigArray('kafka.clusters'),
  );

  const kafkaApis = clusters.map(cluster => ({
    name: cluster.name,
    api: new KafkaJsApiImpl({ clientId, logger, ...cluster }),
  }));

  const router = Router();
  router.use(express.json());

  const kafkaApiByClusterName = _.keyBy(kafkaApis, item => item.name);

  const { config } = options;
  logger.info('Initializing Kafka backend');

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  // Kafka cluster details route
  router.get('/cluster-info', async (req, res) => {
    try {
      const clusterId = 'localhost';
      const consumerId = 'consumerId';
      const kafkaApi = kafkaApiByClusterName[clusterId];
      console.log("====="+ JSON.stringify(kafkaApi, undefined, 2))
      if (!kafkaApi) {
        const candidates = Object.keys(kafkaApiByClusterName)
          .map(n => `"${n}"`)
          .join(', ');
        throw new NotFoundError(
          `Found no configured cluster "${clusterId}", candidates are ${candidates}`,
        );
      }
      logger.info(
        `Fetch consumer group ${consumerId} offsets from cluster ${clusterId}`,
      );
      const groupOffsets = await kafkaApi.api.fetchGroupOffsets(consumerId);

      const groupWithTopicOffsets = await Promise.all(
        groupOffsets.map(async ({ topic, partitions }) => {
          const topicOffsets = _.keyBy(
            await kafkaApi.api.fetchTopicOffsets(topic),
            partition => partition.id,
          );

          return partitions.map(partition => ({
            topic: topic,
            partitionId: partition.id,
            groupOffset: partition.offset,
            topicOffset: topicOffsets[partition.id].offset,
          }));
        }),
      );

      const data = kafkaApi.api.getCompleteClusterSummary();

      console.log("==========================================")
      console.log(JSON.stringify(data, undefined, 2))

      res.json({ consumerId, offsets: groupWithTopicOffsets.flat() });
    } catch (error) {
      logger.error(`Failed to fetch Kafka cluster details:`);
      res.status(500).json({ error: 'Failed to fetch Kafka cluster details' });
    }
  });

  const middleware = MiddlewareFactory.create({ logger, config });

  router.use(middleware.error());
  return router;
}
