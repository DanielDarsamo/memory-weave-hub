import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Camera } from 'lucide-react';
import { toast } from 'sonner';
import MediaCard from '@/components/MediaCard';
import { useMediaDownload } from '@/hooks/use-media-download';

interface Event {
  id: string;
  title: string;
  description: string | null;
  allow_downloads: boolean | null;
}

interface Photo {
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

interface Reaction {
  id: string;
  photo_id: string;
  emoji: string;
  guest_identifier: string;
}

export default function GuestView() {
  const { eventCode } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [uploaderName, setUploaderName] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [guestId] = useState(() => `guest-${Date.now()}-${Math.random()}`);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { downloadSingle } = useMediaDownload();

  useEffect(() => {
    if (eventCode) {
      fetchEvent();
      fetchPhotos();
      fetchReactions();

      const photosChannel = supabase
        .channel(`photos-changes-${eventCode}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'photos',
            filter: `event_id=eq.`,
          },
          (payload) => {
            if (payload.new) {
              setPhotos(prev => [payload.new as Photo, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'photos'
          },
          () => {
            fetchPhotos();
          }
        )
        .subscribe();

      const reactionsChannel = supabase
        .channel(`reactions-changes-${eventCode}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reactions'
          },
          () => {
            fetchReactions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(photosChannel);
        supabase.removeChannel(reactionsChannel);
      };
    }
  }, [eventCode]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description')
      .eq('event_code', eventCode)
      .single();

    if (error || !data) {
      toast.error('Event not found');
      return;
    }

    setEvent(data);
  };

  const fetchPhotos = async () => {
    if (!event) return;

    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', event.id)
      .order('created_at', { ascending: false });

    setPhotos(data || []);
  };

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('reactions')
      .select('*');

    setReactions(data || []);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !event) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${event.id}/${Date.now()}-${Math.random()}.${fileExt}`;
      const isVideo = file.type.startsWith('video/');

      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(fileName, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      let videoDuration: number | null = null;
      let videoWidth: number | null = null;
      let videoHeight: number | null = null;

      if (isVideo) {
        try {
          const videoData = await new Promise<{ duration: number; width: number; height: number }>((resolve) => {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
              resolve({
                duration: Math.round(video.duration),
                width: video.videoWidth,
                height: video.videoHeight,
              });
            };
            video.src = URL.createObjectURL(file);
          });
          videoDuration = videoData.duration;
          videoWidth = videoData.width;
          videoHeight = videoData.height;
        } catch (err) {
          console.error('Failed to extract video metadata:', err);
        }
      }

      const { error: dbError } = await supabase.from('photos').insert({
        event_id: event.id,
        storage_path: fileName,
        uploader_name: uploaderName || null,
        caption: caption || null,
        file_type: file.type,
        file_size: file.size,
        is_video: isVideo,
        video_duration: videoDuration,
        video_width: videoWidth,
        video_height: videoHeight,
        file_extension: `.${fileExt}`,
      });

      if (dbError) {
        toast.error('Failed to save upload');
      }
    }

    setIsUploading(false);
    setCaption('');
    setUploaderName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success('Files uploaded!');
  };

  const handleReaction = async (photoId: string, emoji: string) => {
    const existingReaction = reactions.find(
      r => r.photo_id === photoId && r.emoji === emoji && r.guest_identifier === guestId
    );

    if (existingReaction) {
      await supabase
        .from('reactions')
        .delete()
        .eq('id', existingReaction.id);
    } else {
      await supabase.from('reactions').insert({
        photo_id: photoId,
        emoji,
        guest_identifier: guestId,
      });
    }

    fetchReactions();
  };

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from('event-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const getPhotoReactions = (photoId: string) => {
    return reactions.filter(r => r.photo_id === photoId);
  };

  const hasReacted = (photoId: string, emoji: string) => {
    return reactions.some(
      r => r.photo_id === photoId && r.emoji === emoji && r.guest_identifier === guestId
    );
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading event...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full">
              <Camera className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
          {event.description && (
            <p className="text-primary-foreground/90">{event.description}</p>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card className="mb-8 shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-2">Share Your Memories</h2>
            <p className="text-sm text-muted-foreground mb-4">Upload photos and videos to the event</p>
            <div className="space-y-4">
              <div>
                <Input
                  placeholder="Your name (optional)"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                />
              </div>
              <div>
                <Textarea
                  placeholder="Add a caption (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Photos & Videos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {photos.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">
                No media yet. Be the first to share a moment!
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {photos.filter(p => !p.is_video).length} photos • {photos.filter(p => p.is_video).length} videos
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <MediaCard
                  key={photo.id}
                  media={photo}
                  reactions={reactions}
                  onReaction={handleReaction}
                  onDownload={() => downloadSingle(photo, getPhotoUrl)}
                  showReactions={true}
                  showDownload={event?.allow_downloads}
                  allowDownloads={event?.allow_downloads ?? true}
                  getMediaUrl={getPhotoUrl}
                  hasReacted={hasReacted}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}