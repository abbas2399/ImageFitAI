// src/components/RequirementsInput.tsx

import { useState, type ChangeEvent } from 'react';

interface RequirementsInputProps {
  onRequirementsChange: (requirements: string) => void;
}

const RequirementsInput = ({ onRequirementsChange }: RequirementsInputProps) => {
  const [requirements, setRequirements] = useState<string>('');

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setRequirements(value);
    onRequirementsChange(value);
  };

  const exampleText = `Image must be JPEG, max 200KB, minimum resolution 600x600, aspect ratio 1:1`;

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>Step 2: Enter Image Requirements</h3>
      
      <textarea
        value={requirements}
        onChange={handleChange}
        placeholder={`Enter requirements in natural language, e.g.:\n${exampleText}`}
        rows={5}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          borderRadius: '5px',
          border: '1px solid #ccc',
          fontFamily: 'Arial, sans-serif',
        }}
      />

      {requirements && (
        <div style={{ marginTop: '10px', color: 'green', fontSize: '14px' }}>
          ✓ Requirements entered ({requirements.length} characters)
        </div>
      )}
    </div>
  );
};

export default RequirementsInput;