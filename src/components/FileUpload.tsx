'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FileUploadProps {
  onFileUploaded: (file: UploadedFile) => void
  onFileRemoved: (documentType: string) => void
  documentType: 'articles_of_incorporation' | 'bylaws'
  label: string
  required?: boolean
  existingFile?: UploadedFile | null
  disabled?: boolean
}

export interface UploadedFile {
  id?: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  document_type: string
  url?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf']

export default function FileUpload({
  onFileUploaded,
  onFileRemoved,
  documentType,
  label,
  required = false,
  existingFile = null,
  disabled = false
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only PDF files are allowed'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 10MB'
    }
    return null
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setError('')

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Create unique file path
      const fileExt = file.name.split('.').pop()
      const fileName = `${documentType}_${Date.now()}.${fileExt}`
      const filePath = `company-documents/${user.id}/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-documents')
        .getPublicUrl(filePath)

      const uploadedFile: UploadedFile = {
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        document_type: documentType,
        url: publicUrl
      }

      onFileUploaded(uploadedFile)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }

    uploadFile(file)
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (disabled || uploading) return
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }, [disabled, uploading])

  const handleRemove = async () => {
    if (!existingFile) return

    try {
      // Remove from storage if it exists
      if (existingFile.file_path) {
        await supabase.storage
          .from('company-documents')
          .remove([existingFile.file_path])
      }
      
      onFileRemoved(documentType)
    } catch (err) {
      console.error('Error removing file:', err)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {existingFile ? (
        // Show uploaded file
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {existingFile.file_name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(existingFile.file_size)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {existingFile.url && (
                <a
                  href={existingFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  View
                </a>
              )}
              {!disabled && (
                <button
                  onClick={handleRemove}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Show upload area
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf"
            onChange={(e) => handleFileSelect(e.target.files)}
            disabled={disabled || uploading}
          />
          
          {uploading ? (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-sm text-gray-600">Uploading...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-sm text-gray-600">
                <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
              </div>
              <p className="text-xs text-gray-500">PDF files only, up to 10MB</p>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
