-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  event_code TEXT NOT NULL UNIQUE,
  description TEXT,
  event_date TIMESTAMPTZ,
  allow_downloads BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create photos table
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  uploader_name TEXT,
  caption TEXT,
  file_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create reactions table
CREATE TABLE public.reactions (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  guest_identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(photo_id, emoji, guest_identifier)
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Users can view their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view events by code"
  ON public.events FOR SELECT
  USING (true);

-- Photos policies
CREATE POLICY "Users can view photos for their events"
  ON public.photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = photos.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view photos for public events"
  ON public.photos FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert photos"
  ON public.photos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Event owners can delete photos"
  ON public.photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = photos.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Reactions policies
CREATE POLICY "Anyone can view reactions"
  ON public.reactions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert reactions"
  ON public.reactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete their own reactions"
  ON public.reactions FOR DELETE
  USING (true);

-- Create storage bucket for event photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', true);

-- Storage policies for event-photos bucket
CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-photos');

CREATE POLICY "Event owners can delete photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-photos' AND
    EXISTS (
      SELECT 1 FROM public.photos
      JOIN public.events ON photos.event_id = events.id
      WHERE photos.storage_path = storage.objects.name
      AND events.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for events table
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create function to generate unique event codes
CREATE OR REPLACE FUNCTION public.generate_event_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.events WHERE event_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;