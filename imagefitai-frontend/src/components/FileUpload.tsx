// src/components/FileUpload.tsx

import { useState, type ChangeEvent } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const FileUpload = ({ onFileSelect }: FileUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // Replace ALLOWED_TYPES with:
 const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
  setError('');
  const file = event.target.files?.[0];
  
  if (!file) return;

  // Accept ANY image format
  if (!file.type.startsWith('image/')) {
    setError('Please select an image file (any format)');
    return;
  }

  // Size check
  if (file.size > MAX_FILE_SIZE) {
    setError('File size must be less than 50MB');
    return;
  }

  setSelectedFile(file);
  onFileSelect(file);
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>Step 1: Upload Your Image</h3>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{
          padding: '10px',
          border: '2px dashed #ccc',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      />

      {selectedFile && (
        <div style={{ marginTop: '10px', color: 'green' }}>
          ✓ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
        </div>
      )}

      {error && (
        <div style={{ marginTop: '10px', color: 'red' }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;