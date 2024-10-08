import { Kafka, SeekEntry, Admin, ITopicConfig } from 'kafkajs';
import {
  DeleteResponse,
  PartitionMetadata,
  SaslConfig,
  SslConfig,
  TopicConfig,
  TopicMetadata,
} from '../types/types';
import { LoggerService } from '@backstage/backend-plugin-api';
const { AssignerProtocol } = require('kafkajs');
export type PartitionOffset = {
  id: number;
  offset: string;
};

export type TopicOffset = {
  topic: string;
  partitions: PartitionOffset[];
};

export type Options = {
  clientId: string;
  brokers: string[];
  ssl?: SslConfig;
  sasl?: SaslConfig;
  logger: LoggerService;
};

export interface KafkaApi {
  fetchTopicOffsets(topic: string): Promise<Array<PartitionOffset>>;
  fetchGroupOffsets(groupId: string): Promise<Array<TopicOffset>>;
}

export class KafkaJsApiImpl implements KafkaApi {
  private readonly kafka: Kafka;
  private readonly logger: LoggerService;

  constructor(options: Options) {
    options.logger.debug(
      `creating kafka client with clientId=${options.clientId} and brokers=${options.brokers}`,
    );

    this.kafka = new Kafka(options);
    this.logger = options.logger;
  }

  async fetchTopicOffsets(topic: string): Promise<Array<PartitionOffset>> {
    this.logger.debug(`fetching topic offsets for ${topic}`);

    const admin = this.kafka.admin();
    await admin.connect();

    try {
      return KafkaJsApiImpl.toPartitionOffsets(
        await admin.fetchTopicOffsets(topic),
      );
    } finally {
      await admin.disconnect();
    }
  }

  async fetchGroupOffsets(groupId: string): Promise<Array<TopicOffset>> {
    this.logger.debug(`fetching consumer group offsets for ${groupId}`);

    const admin = this.kafka.admin();
    await admin.connect();

    try {
      const groupOffsets = await admin.fetchOffsets({ groupId });

      return groupOffsets.map(topicOffset => ({
        topic: topicOffset.topic,
        partitions: KafkaJsApiImpl.toPartitionOffsets(topicOffset.partitions),
      }));
    } finally {
      await admin.disconnect();
    }
  }

  async fetchAllConsumerGroups(): Promise<string[]> {
    this.logger.debug(`fetching consumer groups for the cluster`);
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const { groups } = await admin.listGroups();
      return groups.map(group => group.groupId);
    } finally {
      await admin.disconnect();
    }
  }

  private static toPartitionOffsets(
    result: Array<SeekEntry>,
  ): Array<PartitionOffset> {
    return result.map(seekEntry => ({
      id: seekEntry.partition,
      offset: seekEntry.offset,
    }));
  }

  async getCompleteClusterSummary() {
    const admin = this.kafka.admin();

    try {
      await admin.connect();

      // Get cluster info
      const clusterInfo = await admin.describeCluster();

      // Get broker info
      const brokers = clusterInfo.brokers.map(broker => ({
        nodeId: broker.nodeId,
        host: broker.host,
        port: broker.port,
      }));

      // Get topics and their details, filtering out internal topics
      const topicsMetadata = await admin.fetchTopicMetadata();
      const topics = await Promise.all(
        topicsMetadata.topics
          .filter(
            topic =>
              !topic.name.startsWith('__') &&
              topic.name !== '__consumer_offsets',
          )
          .map(async topic => {
            const offsetsResponse = await admin.fetchTopicOffsets(topic.name);
            const partitions = offsetsResponse.map(partition => ({
              partition: partition.partition,
              offset: partition.offset,
            }));

            const totalMessages = partitions.reduce(
              (sum, partition) => sum + (parseInt(partition.offset) || 0),
              0,
            );

            return {
              name: topic.name,
              partition: partitions,
              totalMessages,
              offset: partitions[0]?.offset || null,
            };
          }),
      );

      // Get consumer groups
      const { groups } = await admin.listGroups();
      const consumerGroupsPromises = groups.map(async group => {
        const { groups: groupDetails } = await admin.describeGroups([
          group.groupId,
        ]);
        const groupData = groupDetails[0];

        // Ensure members exist
        const assignedTopics = (groupData.members || []).flatMap(member => {
          const memberAssignmentBuffer = member.memberAssignment;
          const memberMetadataBuffer = member.memberMetadata;

          if (!memberAssignmentBuffer || !memberMetadataBuffer) {
            console.error(
              'Member assignment or metadata is missing for member ID:',
              member.memberId,
            );
            return []; // or handle it appropriately
          }

          // Decode member assignment and metadata
          const memberAssignment = AssignerProtocol.MemberAssignment.decode(
            memberAssignmentBuffer,
          );
          const memberMetadata =
            AssignerProtocol.MemberMetadata.decode(memberMetadataBuffer);

          return memberMetadata.topics.map((topic: string) => {
            const assignedPartitions = memberAssignment.assignment[topic]; // Accessing the assignment for this topic
            return {
              name: group.groupId, // Use groupId as the consumer group name
              topic: [topic], // Wrap topic name in an array
              partitions: assignedPartitions
                ? assignedPartitions.map((partitionId: number) => ({
                    partition: partitionId,
                    offset: 'N/A', // Placeholder for offset
                  }))
                : [],
            };
          });
        });

        return assignedTopics; // Return the array of assigned topics with their partitions
      });

      const consumerGroups = await Promise.all(consumerGroupsPromises);

      // Flatten the consumerGroups array since each promise returns an array
      const flattenedConsumerGroups = consumerGroups.flat();

      // Assemble the final response
      const response = {
        clusterName: clusterInfo.clusterId, // Assuming clusterId is the name
        numberOfBroker: brokers.length,
        brokers,
        topics,
        consumerGroups: flattenedConsumerGroups, // Use flattened consumer groups
      };

      return response;
    } catch (error) {
      console.error('Error fetching Kafka cluster info:', error);
      return 'error';
    } finally {
      await admin.disconnect();
    }
  }

  decodeAssignment = (assignmentBuffer: Buffer) => {
    const topics = [];
    let offset = 0;

    try {
      // Ensure the buffer has enough data to read the topic count (2 bytes)
      if (assignmentBuffer.length < offset + 2) {
        throw new RangeError('Buffer too short to read topic count');
      }

      // Read the number of topics from the buffer
      const topicCount = assignmentBuffer.readInt16BE(offset);
      offset += 2; // Move the offset forward by 2 bytes (16 bits for the count)

      for (let i = 0; i < topicCount; i++) {
        // Ensure the buffer has enough data to read the topic name length (2 bytes)
        if (assignmentBuffer.length < offset + 2) {
          throw new RangeError('Buffer too short to read topic name length');
        }

        // Read the topic name length
        const topicNameLength = assignmentBuffer.readInt16BE(offset);
        offset += 2; // Move the offset forward by 2 bytes

        // Ensure the buffer has enough data to read the topic name
        if (assignmentBuffer.length < offset + topicNameLength) {
          throw new RangeError(
            `Buffer too short to read topic name, expected ${topicNameLength} bytes`,
          );
        }

        // Read the topic name
        const topicName = assignmentBuffer.toString(
          'utf8',
          offset,
          offset + topicNameLength,
        );
        offset += topicNameLength; // Move the offset forward by the topic name length

        // Ensure the buffer has enough data to read the partition count (4 bytes)
        if (assignmentBuffer.length < offset + 4) {
          throw new RangeError('Buffer too short to read partition count');
        }

        // Read the number of partitions
        const partitionCount = assignmentBuffer.readInt32BE(offset);
        offset += 4; // Move the offset forward by 4 bytes

        const partitions = [];
        for (let j = 0; j < partitionCount; j++) {
          // Ensure the buffer has enough data to read each partition ID (4 bytes)
          if (assignmentBuffer.length < offset + 4) {
            throw new RangeError('Buffer too short to read partition ID');
          }

          // Read each partition ID
          const partitionId = assignmentBuffer.readInt32BE(offset);
          partitions.push(partitionId);
          offset += 4; // Move the offset forward by 4 bytes
        }

        // Push the topic and its partitions into the topics array
        topics.push({
          name: topicName,
          partitions,
        });
      }

      return {
        topics,
      };
    } catch (error) {
      return {
        topics, // Return what was decoded so far, or handle this error differently if needed
      };
    }
  };

  async createTopic(topicConfig: TopicConfig): Promise<boolean> {
    const kafka = new Kafka({
      clientId: 'your-client-id',
      brokers: ['localhost:9092'],
    });

    const admin: Admin = kafka.admin();

    try {
      await admin.connect();

      // Destructure and prepare the topic configuration
      const {
        topicName,
        numPartitions = -1, // Default to -1 to use broker's configuration
        replicationFactor = -1, // Default to -1 to use broker's configuration
        replicaAssignment = [], // Default to an empty array
        configEntries = [], // Default to an empty array
      } = topicConfig;

      const topic: ITopicConfig = {
        topic: topicName,
        numPartitions,
        replicationFactor,
        replicaAssignment,
        configEntries,
      };

      // Create the topic with the specified options
      const result = await admin.createTopics({
        topics: [topic],
        validateOnly: false, // Change this to true for validation only
        waitForLeaders: true, // Wait until leaders are available
        timeout: 5000, // Wait time for topic creation
      });

      console.log(`Topic "${topicName}" created successfully.`);
      return result; // Will return true if created, false if already exists
    } catch (error) {
      console.error('Error creating topic:', error);
      return false; // Indicate failure in creation
    } finally {
      await admin.disconnect();
    }
  }

  // Add fetchTopic function
  async fetchAllTopicsMetadata(): Promise<TopicMetadata[]> {
    this.logger.debug(`Fetching all topics metadata`);

    const admin = this.kafka.admin();
    await admin.connect();

    try {
      // Step 1: Fetch all topics
      const topics = await admin.listTopics(); // This should return a list of topic names

      // Step 2: Fetch metadata for each topic
      const topicsMetadata = await Promise.all(
        topics.map(async topic => {
          const metadataResponse = await admin.fetchTopicMetadata({
            topics: [topic],
          });

          // Extract topic metadata from the response
          const topicMetadata = metadataResponse.topics[0]; // Assuming there's only one topic in the response

          if (topicMetadata) {
            // Fetch the offsets for the topic's partitions
            const offsets = await admin.fetchTopicOffsets(topic);

            const partitionsData: PartitionMetadata[] =
              topicMetadata.partitions.map(partition => {
                const offsetData = offsets.find(
                  offset => offset.partition === partition.partitionId,
                );
                const currentOffset = offsetData
                  ? parseInt(offsetData.offset)
                  : 0; // Get current offset or default to 0
                const latestOffset = parseInt(
                  offsetData ? offsetData.high : '0',
                ); // Assuming high is the latest offset
                const lag = latestOffset - currentOffset; // Calculate lag

                return {
                  partitionId: partition.partitionId,
                  partitionErrorCode: partition.partitionErrorCode || 0, // default to 0 if not present
                  leader: partition.leader, // Keep as integer
                  replicas: partition.replicas.length, // Count of replicas
                  isr: partition.isr.length, // Count of in-sync replicas
                  offset: currentOffset.toString(), // Include current offset
                  lag: lag.toString(), // Include lag
                };
              });

            // Assuming you want to return the total offset and lag at the topic level
            const totalOffsets = offsets.reduce(
              (acc, offset) => acc + parseInt(offset.offset),
              0,
            );
            const totalLag = offsets.reduce(
              (acc, offset) =>
                acc + (parseInt(offset.high) - parseInt(offset.offset)),
              0,
            );

            return {
              name: topicMetadata.name,
              offset: totalOffsets.toString(), // Total offset as string
              lag: totalLag.toString(), // Total lag as string
              partitions: partitionsData, // Ensure this matches PartitionMetadata[]
            };
          }

          return null; // Return null if topicMetadata is not found
        }),
      );

      // Step 3: Filter out null results and assert type
      return topicsMetadata.filter(
        (metadata): metadata is TopicMetadata =>
          metadata !== null && !metadata.name.startsWith('__'),
      ) as TopicMetadata[];
    } catch (error) {
      this.logger.error(`Error fetching all topics metadata: ${error}`);
      throw error; // Rethrow error to handle it properly in the calling function
    } finally {
      await admin.disconnect();
    }
  }

  async deleteTopic(topicName: string): Promise<DeleteResponse> {
    const admin = this.kafka.admin();

    try {
      await admin.connect();

      // Delete the specified topic
       await admin.deleteTopics({
        topics: [topicName],
        timeout: 5000, // Timeout in milliseconds
      });

      return {
        success: true,
        message: "Successfuly deleted the topic"
      }; // Will return true if deleted, false if it does not exist
    } catch (error) {
      if (error instanceof Error) {
        // Check if the error is an instance of Error
        this.logger.error(`Error deleting topic "${topicName}":`, error);
      } else {
        this.logger.error(`Unknown error deleting topic "${topicName}":`);
      }
      return {
        success: false,
        message: "Successfuly deleted the topic"
      };; // Indicate failure
    } finally {
      await admin.disconnect();
    }
  }
}
