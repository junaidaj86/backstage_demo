import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import express, { Request, Response } from 'express';
import Router from 'express-promise-router';
import { KafkaApi, KafkaJsApiImpl } from './KafkaApi';
import { getClusterDetails } from '../config/ClusterReader';
import _ from 'lodash';
import { NotFoundError } from '@backstage/errors';
import { TopicConfig } from '../types/types';

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

   

      res.json({ consumerId, offsets: groupWithTopicOffsets.flat() });
    } catch (error) {
      logger.error(`Failed to fetch Kafka cluster details:`);
      res.status(500).json({ error: 'Failed to fetch Kafka cluster details' });
    }
  });

  router.get('/fetch-topics', async (req, res) => {
    try {
      const clusterId = 'localhost'; // Adjust as necessary to get the correct cluster ID
      const kafkaApi = kafkaApiByClusterName[clusterId];

      // Log the kafkaApi being used
      if (!kafkaApi) {
        const candidates = Object.keys(kafkaApiByClusterName)
          .map(n => `"${n}"`)
          .join(', ');
        throw new NotFoundError(
          `Found no configured cluster "${clusterId}", candidates are ${candidates}`,
        );
      }

      // Fetch topics using the Kafka API
      const topics = await kafkaApi.api.fetchAllTopicsMetadata(); // Assumes there's a method to fetch topics

      // Process topics to a suitable format (if needed)
      const formattedTopics = topics?.map(topic => ({
        name: topic.name,
        partitions: topic.partitions.map(partition => ({
          id: partition.partitionId,
          leader: partition.leader,
          replicas: partition.replicas,
          isr: partition.isr,
          partitionErrorCode: partition.partitionErrorCode,
        })),
      }));


      res.json({ topics: formattedTopics });
    } catch (error) {
      logger.error(`Failed to fetch Kafka topics: ${error.message}`);
      res.status(500).json({ error: 'Failed to fetch Kafka topics' });
    }
  });

  router.post('/create-topic', async (req: Request, res: Response) => {
    try {
      // Extract topic configuration from the request body
      const topicConfig: TopicConfig = req.body;

      // Validate the input
      if (!topicConfig.topicName) {
        return res.status(400).json({ error: 'Topic name is required.' });
      }

      const clusterId = 'localhost'; // Adjust as necessary to get the correct cluster ID
      const kafkaApi = kafkaApiByClusterName[clusterId];

      // Log the kafkaApi being used
      if (!kafkaApi) {
        const candidates = Object.keys(kafkaApiByClusterName)
          .map(n => `"${n}"`)
          .join(', ');
        throw new NotFoundError(
          `Found no configured cluster "${clusterId}", candidates are ${candidates}`,
        );
      }

      const success = await kafkaApi.api.createTopic(topicConfig);
      if (success) {
        res.status(201).json({
          success: true,
          message: `Topic "${topicConfig.topicName}" created successfully.`,
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to create topic "${topicConfig.topicName}".`,
        });
      }
    } catch (error) {
      console.error('Error creating Kafka topic:', error);
      res.status(500).json({ error: 'Error creating Kafka topic.' });
    }
  });

  const middleware = MiddlewareFactory.create({ logger, config });

  router.use(middleware.error());
  return router;
}
