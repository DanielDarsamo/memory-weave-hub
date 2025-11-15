/*
  # Add video and media metadata fields to photos table

  1. Changes Made
    - Add file_size (bigint) to track uploaded file sizes in bytes
    - Add video_duration (integer) to store video length in seconds
    - Add video_width and video_height (integer) for video dimensions
    - Add is_video (boolean) for quick video identification
    - Add file_extension (text) for preserving original file type
  
  2. Performance
    - Created indexes on event_id, created_at for faster queries
    - Created index on is_video for filtering between photos and videos
  
  3. Notes
    - file_size helps with storage quota tracking
    - video metadata enables better display and playback handling
    - is_video field speeds up filtering between photos and videos
    - file_extension preserves original file format info
*/

ALTER TABLE public.photos ADD COLUMN file_size bigint DEFAULT 0;
ALTER TABLE public.photos ADD COLUMN is_video boolean DEFAULT false;
ALTER TABLE public.photos ADD COLUMN video_duration integer;
ALTER TABLE public.photos ADD COLUMN video_width integer;
ALTER TABLE public.photos ADD COLUMN video_height integer;
ALTER TABLE public.photos ADD COLUMN file_extension text;

-- Create indexes for better query performance
CREATE INDEX idx_photos_event_id_created_at 
  ON public.photos(event_id, created_at DESC);

CREATE INDEX idx_photos_is_video 
  ON public.photos(is_video);