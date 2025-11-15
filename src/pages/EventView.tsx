import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Download, QrCode, Trash2, Heart, ThumbsUp, Star, Laugh } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Event {
  id: string;
  title: string;
  event_code: string;
  user_id: string;
  allow_downloads: boolean;
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

export default function EventView() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchPhotos();
      fetchReactions();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !data) {
      toast.error('Event not found');
      navigate('/dashboard');
      return;
    }

    setEvent(data);
    setIsOwner(user?.id === data.user_id);

    const guestUrl = `${window.location.origin}/guest/${data.event_code}`;
    const qr = await QRCode.toDataURL(guestUrl);
    setQrCodeUrl(qr);
  };

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    setPhotos(data || []);
  };

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('reactions')
      .select('*');

    setReactions(data || []);
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!confirm('Delete this photo?')) return;

    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      toast.error('Failed to delete photo');
      return;
    }

    await supabase.storage.from('event-photos').remove([storagePath]);

    toast.success('Photo deleted');
    fetchPhotos();
  };

  const handleDownloadAll = async () => {
    toast.success('Downloading all photos...');
    // Implementation would involve downloading all photos as a zip
  };

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from('event-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const getPhotoReactions = (photoId: string) => {
    return reactions.filter(r => r.photo_id === photoId);
  };

  const emojiIcons = {
    heart: Heart,
    thumbs: ThumbsUp,
    star: Star,
    laugh: Laugh,
  };

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{event.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Code: <span className="font-mono">{event.event_code}</span>
                </p>
              </div>
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR
                </Button>
                {event.allow_downloads && (
                  <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {photos.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-muted-foreground">No photos yet. Share the event code with guests!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => {
              const photoReactions = getPhotoReactions(photo.id);
              const reactionCounts = photoReactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <Card key={photo.id} className="overflow-hidden group">
                  <div className="relative aspect-square">
                    <img
                      src={getPhotoUrl(photo.storage_path)}
                      alt={photo.caption || 'Event photo'}
                      className="w-full h-full object-cover"
                    />
                    {isOwner && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardContent className="p-3">
                    {photo.caption && (
                      <p className="text-sm mb-2">{photo.caption}</p>
                    )}
                    {photo.uploader_name && (
                      <p className="text-xs text-muted-foreground mb-2">
                        by {photo.uploader_name}
                      </p>
                    )}
                    {Object.keys(reactionCounts).length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(reactionCounts).map(([emoji, count]) => {
                          const Icon = emojiIcons[emoji as keyof typeof emojiIcons];
                          return (
                            <div
                              key={emoji}
                              className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full"
                            >
                              {Icon && <Icon className="h-3 w-3" />}
                              <span>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <img src={qrCodeUrl} alt="Event QR Code" className="w-64 h-64" />
            <p className="text-sm text-muted-foreground text-center">
              Guests can scan this code to access the event
            </p>
            <p className="text-lg font-mono font-semibold">{event.event_code}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}