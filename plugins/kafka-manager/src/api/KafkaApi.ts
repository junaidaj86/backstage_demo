import {
  KafkaApi,
  ConsumerGroupOffsetsResponse,
  KafkaTopicsResponse,
  TopicConfig,
  KafkaCreateTopicResponse,
} from './types';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';

export class KafkaBackendClient implements KafkaApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly identityApi: IdentityApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    identityApi: IdentityApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.identityApi = options.identityApi;
  }

  private async internalGet(path: string): Promise<any> {
    const url = `${await this.discoveryApi.getBaseUrl(
      'kafka-manager-backend',
    )}${path}`;
    const { token: idToken } = await this.identityApi.getCredentials();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken && { Authorization: `Bearer ${idToken}` }),
      },
    });

    if (!response.ok) {
      const payload = await response.text();
      const message = `Request failed with ${response.status} ${response.statusText}, ${payload}`;
      throw new Error(message);
    }

    return await response.json();
  }

  async getConsumerGroupOffsets(): Promise<ConsumerGroupOffsetsResponse> {
    return await this.internalGet(`/cluster-info`);
  }

  async fetchTopics(): Promise<KafkaTopicsResponse> {
    const path = '/fetch-topics';
    const url = `${await this.discoveryApi.getBaseUrl(
      'kafka-manager-backend',
    )}${path}`;
    const { token: idToken } = await this.identityApi.getCredentials();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken && { Authorization: `Bearer ${idToken}` }),
      },
    });
   
    
    if (!response.ok) {
      const payload = await response.text();
      const message = `Request failed with ${response.status} ${response.statusText}, ${payload}`;
      throw new Error(message);
    }
    return await response.json();
  }

  async createTopic(
    topicConfig: TopicConfig,
  ): Promise<KafkaCreateTopicResponse> {
    const path = '/create-topic';
    const url = `${await this.discoveryApi.getBaseUrl('kafka-manager-backend')}${path}`;
    const { token: idToken } = await this.identityApi.getCredentials();
  
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken && { Authorization: `Bearer ${idToken}` }), // Add Authorization if the token exists
      },
      body: JSON.stringify(topicConfig), // Send topic configuration in the request body
    });
  
    const payload = await response.text(); // Read the response once
  
  
    if (!response.ok) {
      const message = `Request failed with ${response.status} ${response.statusText}, ${payload}`;
      throw new Error(message); // Use the read payload here for the error message
    }
  
  
    return JSON.parse(payload); // Use the already-read payload to parse the JSON
  }
  
}
