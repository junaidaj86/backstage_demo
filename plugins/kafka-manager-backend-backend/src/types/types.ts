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

import { ConnectionOptions } from 'tls';

export interface ClusterDetails {
  name: string;
  brokers: string[];
  ssl?: SslConfig;
  sasl?: SaslConfig;
}

export type SslConfig = ConnectionOptions | boolean;

export type SaslConfig =
  | {
      mechanism: 'plain';
      username: string;
      password: string;
    }
  | {
      mechanism: 'scram-sha-256';
      username: string;
      password: string;
    }
  | {
      mechanism: 'scram-sha-512';
      username: string;
      password: string;
    };

    export type TopicConfig = {
        topicName: string;
        numPartitions?: number; // Optional
        replicationFactor?: number; // Optional
        replicaAssignment?: Array<{ partition: number; replicas: number[] }>; // Optional
        configEntries?: Array<{ name: string; value: string }>; // Optional
    }


    export interface PartitionMetadata {
      partitionId: number;
      leader: number;
      replicas: number;
      isr: number;
      partitionErrorCode: number;
      offset: string; // Added
      lag: string;    // Added
  }
  
  export interface TopicMetadata {
      name: string;
      partitions: PartitionMetadata[];
      offset: string; // This was not previously included
      lag: string;    // This was not previously included
  }

  export interface DeleteResponse {
    success: boolean;
    message: string;
  }
  
  
    