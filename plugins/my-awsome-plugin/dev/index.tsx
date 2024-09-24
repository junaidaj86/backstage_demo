import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { myAwsomePluginPlugin, MyAwsomePluginPage } from '../src/plugin';

createDevApp()
  .registerPlugin(myAwsomePluginPlugin)
  .addPage({
    element: <MyAwsomePluginPage />,
    title: 'Root Page',
    path: '/my-awsome-plugin',
  })
  .render();
