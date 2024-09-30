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
  TablePagination,
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

const fetchTopics = async (kafkaClient: KafkaBackendClient): Promise<TopicMetadata[]> => {
  const response: KafkaTopicsResponse = await kafkaClient.fetchTopics();
  const kafkaTopics = response.topics;

  const transformedTopics = kafkaTopics
    .filter(topic => !topic.name.startsWith('__')) // Filter out topics starting with '__'
    .map(topic => ({
      name: topic.name,
      offset: topic.offset,
      lag: topic.lag,
      partitions: topic.partitions.map(partition => ({
        id: partition.id,
        leader: partition.leader,
        replicas: partition.replicas,
        isr: partition.isr,
        partitionErrorCode: partition.partitionErrorCode || 0,
        offset: partition.offset || '0',
        lag: partition.lag || '0'
      }))
    }));
  return transformedTopics;
};

const createTopic = async (topicConfig: TopicConfig, kafkaClient: KafkaBackendClient) => {
  const response: KafkaCreateTopicResponse = await kafkaClient.createTopic(topicConfig);
  return response;
};


const deleteTopic = async (topicName: string, kafkaClient: KafkaBackendClient) => {
  console.log("start2")
  const response: KafkaCreateTopicResponse = await kafkaClient.deleteTopic(topicName);
  return response;
};

export const KafkaManagement = () => {
  const [topics, setTopics] = useState<TopicMetadata[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newTopic, setNewTopic] = useState<TopicConfig>({
    topicName: '',
    numPartitions: 1,
    replicationFactor: 1,
    replicaAssignment: [],
    configEntries: [],
  });
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  
  // State for expandable rows
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const kafkaClient = new KafkaBackendClient({ discoveryApi, identityApi });

  const loadTopics = async () => {
    const topicsData = await fetchTopics(kafkaClient);
    setTopics(topicsData);
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

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

  const handleConfigEntryChange = (index: number, field: string, value: string) => {
    const updatedConfigEntries = newTopic.configEntries?.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry,
    );
    setNewTopic(prev => ({ ...prev, configEntries: updatedConfigEntries }));
  };

  const addConfigEntry = () => {
    setNewTopic(prev => ({
      ...prev,
      configEntries: [...(prev.configEntries || []), { name: '', value: '' }],
    }));
  };

  const removeConfigEntry = (index: number) => {
    const updatedConfigEntries = newTopic.configEntries?.filter((_, i) => i !== index);
    setNewTopic(prev => ({ ...prev, configEntries: updatedConfigEntries }));
  };

  const handleCreateTopic = async () => {
    const res: KafkaCreateTopicResponse = await createTopic(newTopic, kafkaClient);
    if (res.success) {
      loadTopics();
      handleClose();
    }else{
      //display error message
    }
  };

  const handleDeleteTopic = async (topicName: string) => {
    console.log("start")
    const res: KafkaCreateTopicResponse = await deleteTopic(topicName, kafkaClient);
    if (res.success) {
      loadTopics();
      handleClose();
    }else{
      //display error message
    }
  };

  const toggleAdvancedSettings = () => setShowAdvanced(prev => !prev);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Function to toggle row expansion
  const handleRowClick = (topicName: string) => {
    setExpandedRows(prev =>
      prev.includes(topicName)
        ? prev.filter(name => name !== topicName)
        : [...prev, topicName]
    );
  };


  // Filter topics based on the search term
  const filteredTopics = topics.filter(topic =>
    topic.name.toLowerCase().includes(searchTerm.toLowerCase())
);

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
              <div>
              <input
                type="text"
                placeholder="Search topics..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ marginBottom: '20px', padding: '8px', width: '300px' }}
            />
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
                    {filteredTopics.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((topic, index) => (
                      <React.Fragment key={topic.name}>
                        <TableRow
                          hover
                          onClick={() => handleRowClick(topic.name)}
                          style={{ cursor: 'pointer' }}
                        >
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
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                            <Collapse in={expandedRows.includes(topic.name)} timeout="auto" unmountOnExit>
                              <div style={{ padding: '16px' }}>
                                <Typography variant="h6" gutterBottom>
                                  Partition Details
                                </Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Partition ID</TableCell>
                                      <TableCell>Leader</TableCell>
                                      <TableCell>Replicas</TableCell>
                                      <TableCell>ISR</TableCell>
                                      <TableCell>Offset</TableCell>
                                      <TableCell>Lag</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {topic.partitions.map(partition => (
                                      <TableRow key={partition.id}>
                                        <TableCell>{partition.id}</TableCell>
                                        <TableCell>{partition.leader}</TableCell>
                                        <TableCell>{partition.replicas}</TableCell>
                                        <TableCell>{partition.isr}</TableCell>
                                        <TableCell>{partition.offset}</TableCell>
                                        <TableCell>{partition.lag}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={topics.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </TableContainer>
              </div>
            </InfoCard>
          </Grid>
        </Grid>

        {/* Add Topic Dialog */}
        <Dialog open={open} onClose={handleClose}>
          <DialogTitle>Create New Topic</DialogTitle>
          <DialogContent>
            <DialogContentText>
              To create a new Kafka topic, please enter the details below.
            </DialogContentText>
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
