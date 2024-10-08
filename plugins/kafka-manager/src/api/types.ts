/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';

export const kafkaApiRef = createApiRef<KafkaApi>({
  id: 'plugin.kafka.service',
});

export const kafkaDashboardApiRef = createApiRef<KafkaDashboardApi>({
  id: 'plugin.kafka.dashboard',
});

export type ConsumerGroupOffsetsResponse = {
  consumerId: string;
  offsets: {
    topic: string;
    partitionId: number;
    topicOffset: string;
    groupOffset: string;
  }[];
};

export interface KafkaApi {
  getConsumerGroupOffsets(
    clusterId: string,
    consumerGroup: string,
  ): Promise<ConsumerGroupOffsetsResponse>;
}

export interface KafkaDashboardApi {
  getDashboardUrl(
    clusterId: string,
    consumerGroup: string,
    entity: Entity,
  ): { url?: string };
}

export interface KafkaCreateTopicResponse {
  success: boolean;
  message: string;
}

export interface TopicConfig {
  topicName: string; // Required: The name of the Kafka topic
  numPartitions?: number; // Optional: Number of partitions
  replicationFactor?: number; // Optional: Replication factor
  replicaAssignment?: number[][]; // Optional: Replica assignment for partitions
  configEntries?: ConfigEntry[]; // Optional: Array of config entries for topic settings
}

export interface ConfigEntry {
  name: string;
  value: string;
}


// Assuming the structure based on your JSON response
export interface PartitionMetadata {
  id: number;
  leader: number;
  replicas: number;
  isr: number;
  partitionErrorCode: number;
  offset: string;                   // Current offset as a string
  lag: string;
}

export interface TopicMetadata {
  name: string; // Should match the topic name
  partitions: PartitionMetadata[]; // Should contain partition information
  offset: string;                   // Total offsets as a string for the topic
  lag: string;
}

// This interface represents the entire response from your Kafka backend
export interface KafkaTopicsResponse {
  topics: TopicMetadata[]; // This should return the topics as an array of TopicMetadata
}

export interface KafkaCreateTopicResponse {
  success: boolean;
  message: string;
}
