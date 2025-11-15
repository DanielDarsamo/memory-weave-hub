import React, { useState } from 'react';
import { Heart, ThumbsUp, Star, Laugh, Download, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface Media {
  id: string;
  storage_path: string;
  uploader_name: string | null;
  caption: string | null;
  created_at: string;
  is_video: boolean | null;
  file_type: string;
  file_extension: string | null;
  file_size: number | null;
}

interface MediaCardProps {
  media: Media;
  reactions: Array<{ id: string; photo_id: string; emoji: string; guest_identifier: string }>;
  onReaction: (mediaId: string, emoji: string) => void;
  onDelete?: (mediaId: string, storagePath: string) => void;
  onDownload?: (media: Media) => void;
  isOwner?: boolean;
  showReactions?: boolean;
  showDownload?: boolean;
  allowDownloads?: boolean;
  getMediaUrl: (path: string) => string;
  hasReacted?: (mediaId: string, emoji: string) => boolean;
}

const EMOJIS = [
  { type: 'heart', icon: Heart, label: 'Love' },
  { type: 'thumbs', icon: ThumbsUp, label: 'Like' },
  { type: 'star', icon: Star, label: 'Amazing' },
  { type: 'laugh', icon: Laugh, label: 'Fun' },
];

export default function MediaCard({
  media,
  reactions,
  onReaction,
  onDelete,
  onDownload,
  isOwner = false,
  showReactions = true,
  showDownload = false,
  allowDownloads = true,
  getMediaUrl,
  hasReacted,
}: MediaCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayable, setIsPlayable] = useState(false);

  const mediaReactions = reactions.filter(r => r.photo_id === media.id);
  const reactionCounts = mediaReactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleDownload = async () => {
    if (!allowDownloads) return;

    try {
      setIsLoading(true);
      const url = getMediaUrl(media.storage_path);
      const response = await fetch(url);
      const blob = await response.blob();

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${media.file_extension ? `media${media.file_extension}` : 'media'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success('Downloaded successfully');
      onDownload?.(media);
    } catch (error) {
      toast.error('Failed to download');
      console.error('Download error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isVideo = media.is_video || media.file_type.startsWith('video/');

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-square bg-muted">
        {isVideo ? (
          <>
            <video
              src={getMediaUrl(media.storage_path)}
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                setIsLoading(false);
                setIsPlayable(true);
              }}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white">Loading video...</div>
              </div>
            )}
            {isPlayable && (
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="h-12 w-12 text-white fill-white" />
              </div>
            )}
          </>
        ) : (
          <>
            <img
              src={getMediaUrl(media.storage_path)}
              alt={media.caption || 'Photo'}
              className="w-full h-full object-cover"
              onLoad={() => setIsLoading(false)}
            />
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white">Loading photo...</div>
              </div>
            )}
          </>
        )}

        {(showDownload || isOwner) && (
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {showDownload && allowDownloads && (
              <Button
                variant="default"
                size="icon"
                className="bg-primary/90 hover:bg-primary"
                onClick={handleDownload}
                disabled={isLoading}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {isOwner && onDelete && (
              <Button
                variant="destructive"
                size="icon"
                onClick={() => onDelete(media.id, media.storage_path)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <CardContent className="p-3">
        {media.caption && (
          <p className="text-sm mb-2">{media.caption}</p>
        )}
        {media.uploader_name && (
          <p className="text-xs text-muted-foreground mb-3">
            by {media.uploader_name}
          </p>
        )}

        {showReactions && (
          <div className="flex gap-1 flex-wrap">
            {EMOJIS.map(({ type, icon: Icon, label }) => {
              const count = reactionCounts[type] || 0;
              const reacted = hasReacted ? hasReacted(media.id, type) : false;
              return (
                <Button
                  key={type}
                  variant={reacted ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => onReaction(media.id, type)}
                  title={label}
                >
                  <Icon className="h-3 w-3" />
                  {count > 0 && (
                    <span className="ml-1 text-xs">{count}</span>
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
