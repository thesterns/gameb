-- Add image_url column to questions
ALTER TABLE public.questions ADD COLUMN image_url text;

-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true);

-- Allow authenticated users to upload to question-images bucket
CREATE POLICY "Authenticated users can upload question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'question-images');

-- Allow anyone to view question images (needed during gameplay)
CREATE POLICY "Anyone can view question images"
ON storage.objects FOR SELECT
USING (bucket_id = 'question-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete question images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'question-images');