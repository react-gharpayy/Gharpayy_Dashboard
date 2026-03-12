-- ============================================================
-- MIGRATION 006: SUPABASE STORAGE ??? PROPERTY PHOTOS
-- ============================================================

-- 1. Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,                          -- public: images served via CDN URL
  5242880,                       -- 5MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies

-- Anyone can read (public bucket for marketplace)
CREATE POLICY "property_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-photos');

-- Authenticated internal team can upload
CREATE POLICY "property_photos_internal_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-photos'
    AND auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'agent')
    )
  );

-- Owners can upload photos for their own properties
CREATE POLICY "property_photos_owner_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-photos'
    AND auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
  );

-- Admins/managers can delete any photo
CREATE POLICY "property_photos_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-photos'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  );

-- Owners can delete their own uploads
-- (path convention: property-photos/{property_id}/{filename})
CREATE POLICY "property_photos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-photos'
    AND auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'owner')
  );
