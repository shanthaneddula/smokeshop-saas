'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  currentImage?: string | null;
  disabled?: boolean;
}

export default function ImageUpload({ onUploadComplete, currentImage, disabled }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadComplete(data.url);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload image');
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Preview */}
      {preview && (
        <div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden">
          <img
            src={preview}
            alt="Product preview"
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Upload Button */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex-1"
        >
          {uploading ? 'Uploading...' : preview ? 'Change Image' : '📷 Upload Image'}
        </Button>

        {preview && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPreview(null);
              onUploadComplete('');
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            disabled={disabled || uploading}
          >
            Remove
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Max file size: 5MB. Supported formats: JPEG, PNG, WebP, GIF
      </p>
    </div>
  );
}
