import React, { useState, useEffect } from 'react';
import {
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Link,
  Collapse,
  IconButton,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from '@material-ui/core';
import {
  InfoCard,
  Page,
  Content,
  ContentHeader,
} from '@backstage/core-components';
import { AddCircle, Delete, RemoveCircle } from '@material-ui/icons';
import { KafkaBackendClient } from '../../api/KafkaApi';
import { ConsumerGroupOffsetsResponse, KafkaCreateTopicResponse, KafkaTopicsResponse, TopicConfig, TopicMetadata } from '../../api/types';
import { discoveryApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { useApi } from '@backstage/core-plugin-api';
import { partition } from 'lodash';



// Example Kafka configuration keys
const configOptions = [
  { label: 'Cleanup Policy', value: 'cleanup.policy' },
  { label: 'Compression Type', value: 'compression.type' },
  { label: 'Retention Time (ms)', value: 'retention.ms' },
  { label: 'Segment Bytes', value: 'segment.bytes' },
  { label: 'Min In-Sync Replicas', value: 'min.insync.replicas' },
];



const fetchTopics = async (
  kafkaClient: KafkaBackendClient,
): Promise<TopicMetadata[]> => { 
  const response: KafkaTopicsResponse = await kafkaClient.fetchTopics();
  // Access the topics from the response
  const kafkaTopics = response.topics;

    const transformedTopics = kafkaTopics
    .filter(topic => !topic.name.startsWith('__')) // Filter out topics starting with '__'
    .map(topic => ({
      name: topic.name, // Change 'name' to 'topicName'
      offset: topic.offset, // Ensure it's a string
      lag: topic.lag, // Ensure it's a string
      partitions: topic.partitions.map(partition => ({
        id: partition.id, // Ensure 'id' matches the required field
        leader: partition.leader, // Keep as it is
        replicas: partition.replicas, // Ensure replicas are in array form
        isr: partition.isr, // Ensure isr is in array form
        partitionErrorCode: partition.partitionErrorCode || 0, // Default to 0 if not present
        offset: partition.offset || '0', // Default offset to '0' if not present
        lag: partition.lag || '0' // Default lag to '0' if not present
      }))
    }));

    return transformedTopics;
};

const createTopic = async (topicConfig: TopicConfig,  kafkaClient: KafkaBackendClient) => {
  const response: KafkaCreateTopicResponse = await kafkaClient.createTopic(topicConfig);
  return response;
};

export const KafkaManagement = () => {
  const [topics, setTopics] = useState<TopicMetadata[]>([]);
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false); // For advanced settings toggle
  const [newTopic, setNewTopic] = useState<TopicConfig>({
    topicName: '',
    numPartitions: 1,
    replicationFactor: 1,
    replicaAssignment: [],
    configEntries: [],
  });

  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const kafkaClient = new KafkaBackendClient({ discoveryApi, identityApi });

  const loadTopics = async () => {
    const topicsData = await fetchTopics(kafkaClient); // Pass the kafkaClient as argument
    setTopics(topicsData);
  };
  // Fetch topics when component loads
  useEffect(() => {
    loadTopics();
  }, []);

  // Handle opening and closing the modal
  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // Handle input change in the modal form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewTopic(prev => ({
      ...prev,
      [name]:
        name === 'numPartitions' || name === 'replicationFactor'
          ? parseInt(value)
          : value,
    }));
  };

  // Handle config entry change for dropdown and value
  const handleConfigEntryChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    const updatedConfigEntries = newTopic.configEntries?.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    setNewTopic(prev => ({ ...prev, configEntries: updatedConfigEntries }));
  };

  // Add a new config entry
  const addConfigEntry = () => {
    setNewTopic(prev => ({
      ...prev,
      configEntries: [...(prev.configEntries || []), { name: '', value: '' }],
    }));
  };

  // Remove a config entry
  const removeConfigEntry = (index: number) => {
    const updatedConfigEntries = newTopic.configEntries?.filter(
      (_, i) => i !== index,
    );
    setNewTopic(prev => ({ ...prev, configEntries: updatedConfigEntries }));
  };

  // Handle topic creation
  const handleCreateTopic = async () => {
    const res: KafkaCreateTopicResponse = await createTopic(newTopic, kafkaClient);
    if (res.success) {
      loadTopics();
      handleClose(); // Close the modal on success
    }
  };

  const handleDeleteTopic = async (topicName: string) => {
    //await deleteTopic(topicName, kafkaClient);
    setTopics(prevTopics => prevTopics.filter(topic => topic.name !== topicName));
  };

  // Toggle advanced settings section
  const toggleAdvancedSettings = () => setShowAdvanced(prev => !prev);

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Kafka Self-Service">
          <Button
            variant="contained"
            color="primary"
            onClick={handleClickOpen}
            style={{ float: 'right' }}
          >
            Add Topic
          </Button>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <InfoCard title="Topics List">
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Topic Name</TableCell>
                      <TableCell align="right">Partitions</TableCell>
                      <TableCell align="right">Offset</TableCell>
                      <TableCell align="right">Lag</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topics.map((topic, index) => (
                      <TableRow key={index}>
                        <TableCell component="th" scope="row">
                          {topic.name}
                        </TableCell>
                        <TableCell align="right">
                          {topic.partitions.length}
                        </TableCell>
                        <TableCell align="right">
                          {topic.offset}
                        </TableCell>
                        <TableCell align="right">
                          {topic.lag}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleDeleteTopic(topic.name)}>
                            <Delete color="secondary" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </InfoCard>
          </Grid>
        </Grid>

        {/* Dialog Modal for adding a new topic */}
        <Dialog
          open={open}
          onClose={handleClose}
          aria-labelledby="form-dialog-title"
        >
          <DialogTitle id="form-dialog-title">Create New Topic</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Fill out the basic fields to create a new Kafka topic.
            </DialogContentText>
            {/* Basic Topic Settings */}
            <TextField
              autoFocus
              margin="dense"
              name="topicName"
              label="Topic Name"
              type="text"
              fullWidth
              value={newTopic.topicName}
              onChange={handleInputChange}
            />
            <TextField
              margin="dense"
              name="numPartitions"
              label="Number of Partitions"
              type="number"
              fullWidth
              value={newTopic.numPartitions}
              onChange={handleInputChange}
            />
            <TextField
              margin="dense"
              name="replicationFactor"
              label="Replication Factor"
              type="number"
              fullWidth
              value={newTopic.replicationFactor}
              onChange={handleInputChange}
            />

            {/* Advanced Settings Link */}
            <Link
              component="button"
              variant="body2"
              onClick={toggleAdvancedSettings}
              style={{ marginTop: '10px', display: 'block' }}
            >
              {showAdvanced
                ? 'Hide Advanced Settings'
                : 'Show Advanced Settings'}
            </Link>

            {/* Advanced Topic Settings */}
            <Collapse in={showAdvanced}>
              {/* Config Entries */}
              <Typography variant="h6" style={{ marginTop: '20px' }}>
                Configuration Entries
              </Typography>
              {newTopic.configEntries?.map((entry, index) => (
                <Grid container spacing={2} key={index} alignItems="center">
                  <Grid item xs={5}>
                    <FormControl fullWidth>
                      <InputLabel>Config Name</InputLabel>
                      <Select
                        value={entry.name}
                        onChange={e =>
                          handleConfigEntryChange(
                            index,
                            'name',
                            e.target.value as string,
                          )
                        }
                        fullWidth
                      >
                        {configOptions.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      margin="dense"
                      name={`value-${index}`}
                      label="Config Value"
                      type="text"
                      fullWidth
                      value={entry.value}
                      onChange={e =>
                        handleConfigEntryChange(index, 'value', e.target.value)
                      }
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <IconButton onClick={() => removeConfigEntry(index)}>
                      <RemoveCircle color="secondary" />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button
                variant="contained"
                color="default"
                startIcon={<AddCircle />}
                onClick={addConfigEntry}
                style={{ marginTop: '10px' }}
              >
                Add Config Entry
              </Button>
            </Collapse>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="primary">
              Cancel
            </Button>
            <Button onClick={handleCreateTopic} color="primary">
              Create Topic
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
