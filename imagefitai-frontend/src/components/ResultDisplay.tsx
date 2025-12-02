// src/components/ResultDisplay.tsx

import type { JobStatusResponse } from '../types';

interface ResultDisplayProps {
  jobStatus: JobStatusResponse;
}

const ResultDisplay = ({ jobStatus }: ResultDisplayProps) => {
  if (jobStatus.status !== 'completed') {
    return null;
  }

  return (
    <div style={{ marginTop: '30px' }}>
      <h3>✓ Image Processing Complete!</h3>

      {jobStatus.summary && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#e8f5e9',
            borderRadius: '5px',
            marginBottom: '20px',
          }}
        >
          <strong>Summary:</strong>
          <p style={{ margin: '10px 0 0 0' }}>{jobStatus.summary}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        {/* Original Image */}
        <div style={{ flex: 1 }}>
          <h4>Original Image</h4>
          {jobStatus.originalImageUrl && (
            <img
              src={jobStatus.originalImageUrl}
              alt="Original"
              style={{
                maxWidth: '100%',
                border: '2px solid #ccc',
                borderRadius: '5px',
              }}
            />
          )}
        </div>

        {/* Processed Image */}
        <div style={{ flex: 1 }}>
          <h4>Compliant Image</h4>
          {jobStatus.outputImageUrl && (
            <img
              src={jobStatus.outputImageUrl}
              alt="Processed"
              style={{
                maxWidth: '100%',
                border: '2px solid green',
                borderRadius: '5px',
              }}
            />
          )}
          {jobStatus.outputImageUrl && (
            <a
              href={jobStatus.outputImageUrl}
              download
              style={{
                display: 'inline-block',
                marginTop: '10px',
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '5px',
              }}
            >
              Download Compliant Image
            </a>
          )}
        </div>
      </div>

      {/* Commands Used */}
      {jobStatus.commands && jobStatus.commands.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4>FFmpeg Commands Used:</h4>
          <div
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '5px',
              fontFamily: 'monospace',
              fontSize: '12px',
              overflowX: 'auto',
            }}
          >
            {jobStatus.commands?.map((cmd, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {cmd}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {jobStatus.constraints && (
        <div style={{ marginTop: '20px' }}>
          <h4>Applied Constraints:</h4>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '5px',
              fontSize: '12px',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(jobStatus.constraints, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ResultDisplay;