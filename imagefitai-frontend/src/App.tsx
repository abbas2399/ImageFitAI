// src/App.tsx

import { useState } from 'react';
import FileUpload from './components/FileUpload';
import RequirementsInput from './components/RequirementsInput';
import JobStatus from './components/JobStatus';
import ResultDisplay from './components/ResultDisplay';
import { apiService } from './services/api';
import type { JobStatusResponse } from './types';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [requirements, setRequirements] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError('');
    setJobStatus(null);
  };

  const handleRequirementsChange = (reqs: string) => {
    setRequirements(reqs);
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60; // Poll for up to 60 attempts (5 minutes with 5s intervals)
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await apiService.getJobStatus(jobId);
        setJobStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          setIsProcessing(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setError('Job processing timeout. Please try again.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
        setError('Failed to get job status. Please try again.');
        setIsProcessing(false);
      }
    };

    poll();
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select an image file');
      return;
    }

    if (!requirements.trim()) {
      setError('Please enter image requirements');
      return;
    }

    setError('');
    setIsUploading(true);
    setJobStatus(null);

    try {
      // Step 1: Get presigned URL
      console.log('Getting presigned URL...');
      const { uploadUrl, s3Key } = await apiService.getPresignedUrl(
        selectedFile.name
      );

      // Step 2: Upload to S3
      console.log('Uploading to S3...');
      await apiService.uploadToS3(uploadUrl, selectedFile);

      setIsUploading(false);
      setIsProcessing(true);

      // Step 3: Create job
      console.log('Creating job...');
      const jobResponse = await apiService.createJob({
        s3Key,
        rulesText: requirements,
      });

      console.log('Job created:', jobResponse.jobId);

      // Step 4: Start polling for job status
      pollJobStatus(jobResponse.jobId);
    } catch (err: any) {
      console.error('Error during submission:', err);
      setError(err.response?.data?.message || 'Failed to process image. Please try again.');
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const canSubmit = selectedFile && requirements.trim() && !isUploading && !isProcessing;

  return (
    <div className="App">
      <header>
        <h1>🖼️ ImageFit AI</h1>
        <p>Transform your images to meet strict compliance requirements</p>
      </header>

      <main>
        <FileUpload onFileSelect={handleFileSelect} />

        <RequirementsInput onRequirementsChange={handleRequirementsChange} />

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: canSubmit ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            marginBottom: '20px',
          }}
        >
          {isUploading && 'Uploading...'}
          {isProcessing && 'Processing...'}
          {!isUploading && !isProcessing && 'Process Image'}
        </button>

        {error && (
          <div
            style={{
              padding: '15px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '5px',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <JobStatus jobStatus={jobStatus} isProcessing={isProcessing} />

        {jobStatus && jobStatus.status === 'completed' && (
          <ResultDisplay jobStatus={jobStatus} />
        )}
      </main>
    
    </div>
  );
}

export default App;