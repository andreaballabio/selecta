'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Music, FileAudio, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioUploadProps {
  onUploadComplete: (filePath: string, fileName: string, fileSize: number) => void
  onError?: (error: string) => void
}

const ACCEPTED_FORMATS = {
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/mpeg': ['.mp3'],
  'audio/aiff': ['.aiff', '.aif'],
  'audio/flac': ['.flac'],
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export function AudioUpload({ onUploadComplete, onError }: AudioUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const validateFile = (file: File): string | null => {
    const validExtensions = ['.wav', '.mp3', '.aiff', '.aif', '.flac']
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    
    if (!validExtensions.includes(extension)) {
      return `Formato non supportato. Usa: ${validExtensions.join(', ')}`
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File troppo grande. Max: 100MB`
    }
    
    return null
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const error = validateFile(file)
    if (error) {
      onError?.(error)
      return
    }

    setSelectedFile(file)
    setUploading(true)
    setUploadProgress(0)

    try {
      // Get presigned URL from API
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'audio/wav',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, filePath } = await response.json()

      // Upload file to storage
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(progress)
        }
      })

      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve()
          } else {
            reject(new Error('Upload failed'))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Upload error')))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'audio/wav')
        xhr.send(file)
      })

      onUploadComplete(filePath, file.name, file.size)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Upload failed')
      setSelectedFile(null)
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete, onError])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: 1,
    disabled: uploading,
    multiple: false,
  })

  const clearFile = () => {
    setSelectedFile(null)
    setUploadProgress(0)
  }

  if (selectedFile && !uploading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
              <FileAudio className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-medium text-white">{selectedFile.name}</p>
              <p className="text-sm text-zinc-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            onClick={clearFile}
            className="rounded-lg p-2 hover:bg-zinc-900"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative cursor-pointer rounded-xl border-2 border-dashed p-8 transition-colors',
        isDragActive && !isDragReject && 'border-emerald-500 bg-emerald-500/5',
        isDragReject && 'border-red-500 bg-red-500/5',
        !isDragActive && !isDragReject && 'border-zinc-800 hover:border-zinc-700',
        uploading && 'cursor-not-allowed opacity-50'
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-4 text-center">
        {uploading ? (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
            <div>
              <p className="font-medium text-white">Uploading...</p>
              <p className="text-sm text-zinc-500">{uploadProgress}%</p>
            </div>
            <div className="h-2 w-48 overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
              <Upload className="h-8 w-8 text-zinc-500" />
            </div>
            <div>
              <p className="font-medium text-white">
                {isDragActive ? 'Rilascia il file qui' : 'Trascina il tuo file audio'}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                o clicca per selezionare
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-600">
              <span className="flex items-center gap-1">
                <Music className="h-3 w-3" />
                WAV, MP3, AIFF, FLAC
              </span>
              <span>Max 100MB</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
