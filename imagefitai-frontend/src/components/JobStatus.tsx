// src/components/JobStatus.tsx

// src/components/JobStatus.tsx
import type { JobStatusResponse } from '../types';

interface JobStatusProps {
  jobStatus: JobStatusResponse | null;
  isProcessing: boolean;
}

const JobStatus = ({ jobStatus, isProcessing }: JobStatusProps) => {
  if (!jobStatus && !isProcessing) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'processing':
        return 'orange';
      case 'pending':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
      case 'processing':
        return '⏳';
      case 'pending':
        return '⏳';
      default:
        return '•';
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>Job Status</h3>
      
      {jobStatus && (
        <div
          style={{
            padding: '15px',
            borderRadius: '5px',
            border: `2px solid ${getStatusColor(jobStatus.status)}`,
            backgroundColor: '#f9f9f9',
          }}
        >
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>
            <span style={{ color: getStatusColor(jobStatus.status) }}>
              {getStatusEmoji(jobStatus.status)} Status: {jobStatus.status.toUpperCase()}
            </span>
          </div>

          <div style={{ fontSize: '14px', color: '#666' }}>
            Job ID: {jobStatus.jobId}
          </div>

          {jobStatus.status === 'processing' && (
            <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
              Processing your image... This may take a few seconds.
            </div>
          )}

          {jobStatus.status === 'failed' && jobStatus.error && (
            <div style={{ marginTop: '10px', color: 'red' }}>
              Error: {jobStatus.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobStatus;