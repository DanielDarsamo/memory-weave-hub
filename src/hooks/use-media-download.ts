import { useState } from 'react';
import { toast } from 'sonner';

interface Media {
  storage_path: string;
  file_extension?: string | null;
  is_video?: boolean | null;
  file_type?: string;
}

interface DownloadProgress {
  current: number;
  total: number;
}

export function useMediaDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  const downloadSingle = async (
    media: Media,
    getUrl: (path: string) => string
  ): Promise<void> => {
    try {
      setIsDownloading(true);
      const url = getUrl(media.storage_path);
      const response = await fetch(url);
      const blob = await response.blob();

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);

      const ext = media.file_extension || (media.is_video ? '.mp4' : '.jpg');
      const timestamp = new Date().getTime();
      link.download = `media-${timestamp}${ext}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success('Downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
      throw error;
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadMultiple = async (
    medias: Media[],
    getUrl: (path: string) => string,
    zipFileName: string = 'event-media.zip'
  ): Promise<void> => {
    try {
      setIsDownloading(true);

      const { default: JSZip } = await import('jszip');

      const zip = new JSZip();
      const mediaFolder = zip.folder('media');

      if (!mediaFolder) {
        throw new Error('Failed to create zip folder');
      }

      for (let i = 0; i < medias.length; i++) {
        const media = medias[i];
        setProgress({ current: i, total: medias.length });

        try {
          const url = getUrl(media.storage_path);
          const response = await fetch(url);
          const blob = await response.blob();

          const ext = media.file_extension || (media.is_video ? '.mp4' : '.jpg');
          const fileName = `media-${i + 1}${ext}`;
          mediaFolder.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to download media ${i + 1}:`, err);
        }
      }

      setProgress({ current: medias.length, total: medias.length });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success(`Downloaded ${medias.length} files as zip`);
    } catch (error) {
      console.error('Batch download error:', error);
      toast.error('Failed to download files as zip');
      throw error;
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  return {
    isDownloading,
    progress,
    downloadSingle,
    downloadMultiple,
  };
}
