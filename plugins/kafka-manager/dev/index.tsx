import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { kafkaManagerPlugin, KafkaManagerPage } from '../src/plugin';

createDevApp()
  .registerPlugin(kafkaManagerPlugin)
  .addPage({
    element: <KafkaManagerPage />,
    title: 'Root Page',
    path: '/kafka-manager',
  })
  .render();
