import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, Users, Share2, Heart, QrCode } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Index() {
  const navigate = useNavigate();
  const [eventCode, setEventCode] = useState('');

  const handleJoinEvent = async () => {
    if (!eventCode.trim()) {
      toast.error('Please enter an event code');
      return;
    }

    const { data, error } = await supabase
      .from('events')
      .select('event_code')
      .eq('event_code', eventCode.trim().toUpperCase())
      .single();

    if (error || !data) {
      toast.error('Invalid event code');
      return;
    }

    navigate(`/guest/${eventCode.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        className="relative py-20 px-4"
        style={{ background: 'var(--gradient-hero)' }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <div className="bg-primary text-primary-foreground p-4 rounded-full shadow-[var(--shadow-lg)]">
                <Camera className="h-12 w-12" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Capture Every Moment Together
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Create collaborative photo albums for your events. Every guest becomes a photographer.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" onClick={() => navigate('/auth')}>
                Create Event
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Input
                  placeholder="Enter event code"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  className="w-full sm:w-48"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinEvent()}
                />
                <Button variant="secondary" onClick={handleJoinEvent}>
                  Join Event
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-lg)]">
              <CardContent className="p-6">
                <div className="bg-primary/10 text-primary p-3 rounded-full w-fit mb-4">
                  <QrCode className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Create & Share</h3>
                <p className="text-muted-foreground">
                  Set up your event and generate a unique QR code for guests to scan
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-lg)]">
              <CardContent className="p-6">
                <div className="bg-secondary/10 text-secondary p-3 rounded-full w-fit mb-4">
                  <Camera className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Capture Moments</h3>
                <p className="text-muted-foreground">
                  Guests instantly upload photos and videos throughout your event
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-lg)]">
              <CardContent className="p-6">
                <div className="bg-primary/10 text-primary p-3 rounded-full w-fit mb-4">
                  <Heart className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. React & Collect</h3>
                <p className="text-muted-foreground">
                  Everyone can react to photos and download their favorite memories
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-accent">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Perfect For Any Event</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Heart, title: 'Weddings', desc: 'Capture every angle of your special day' },
              { icon: Users, title: 'Parties', desc: 'Never miss a moment from your celebration' },
              { icon: Share2, title: 'Corporate Events', desc: 'Professional yet collaborative photo sharing' },
              { icon: Camera, title: 'Family Gatherings', desc: 'Keep all your family memories in one place' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Start Creating Memories Today
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of events using our platform to capture and share unforgettable moments
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}>
            Get Started Free
          </Button>
        </div>
      </section>
    </div>
  );
}