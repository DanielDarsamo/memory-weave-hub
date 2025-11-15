import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Heart, ThumbsUp, Star, Laugh, Camera } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description: string | null;
}

interface Photo {
  id: string;
  storage_path: string;
  uploader_name: string | null;
  caption: string | null;
  created_at: string;
}

interface Reaction {
  id: string;
  photo_id: string;
  emoji: string;
  guest_identifier: string;
}

const EMOJIS = [
  { type: 'heart', icon: Heart, label: 'Love' },
  { type: 'thumbs', icon: ThumbsUp, label: 'Like' },
  { type: 'star', icon: Star, label: 'Amazing' },
  { type: 'laugh', icon: Laugh, label: 'Fun' },
];

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

  useEffect(() => {
    if (eventCode) {
      fetchEvent();
      fetchPhotos();
      fetchReactions();

      // Subscribe to realtime updates
      const photosChannel = supabase
        .channel('photos-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'photos'
          },
          () => {
            fetchPhotos();
          }
        )
        .subscribe();

      const reactionsChannel = supabase
        .channel('reactions-changes')
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

      const { error: uploadError } = await supabase.storage
        .from('event-photos')
        .upload(fileName, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { error: dbError } = await supabase.from('photos').insert({
        event_id: event.id,
        storage_path: fileName,
        uploader_name: uploaderName || null,
        caption: caption || null,
        file_type: file.type,
      });

      if (dbError) {
        toast.error('Failed to save photo');
      }
    }

    setIsUploading(false);
    setCaption('');
    toast.success('Photos uploaded!');
    fetchPhotos();
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
            <h2 className="text-lg font-semibold mb-4">Share Your Photos</h2>
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
                {isUploading ? 'Uploading...' : 'Upload Photos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {photos.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">
                No photos yet. Be the first to share a moment!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo) => {
              const photoReactions = getPhotoReactions(photo.id);
              const reactionCounts = photoReactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <Card key={photo.id} className="overflow-hidden">
                  <div className="relative aspect-square">
                    <img
                      src={getPhotoUrl(photo.storage_path)}
                      alt={photo.caption || 'Event photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-3">
                    {photo.caption && (
                      <p className="text-sm mb-2">{photo.caption}</p>
                    )}
                    {photo.uploader_name && (
                      <p className="text-xs text-muted-foreground mb-3">
                        by {photo.uploader_name}
                      </p>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {EMOJIS.map(({ type, icon: Icon, label }) => {
                        const count = reactionCounts[type] || 0;
                        const reacted = hasReacted(photo.id, type);
                        return (
                          <Button
                            key={type}
                            variant={reacted ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => handleReaction(photo.id, type)}
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}