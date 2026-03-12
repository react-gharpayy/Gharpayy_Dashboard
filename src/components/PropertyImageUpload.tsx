import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  X,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Props {
  propertyId: string;
  existingPhotos: string[]; // current photos[] from DB
  onPhotosChange?: (urls: string[]) => void;
  maxPhotos?: number;
}

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
}

const BUCKET = "property-photos";

const PropertyImageUpload = ({
  propertyId,
  existingPhotos,
  onPhotosChange,
  maxPhotos = 10,
}: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const totalPhotos =
    existingPhotos.length + items.filter((i) => i.status === "done").length;
  const canUpload = totalPhotos < maxPhotos;

  // ── File validation ───────────────────────────────────────
  const validate = (file: File): string | null => {
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.type,
      )
    ) {
      return "Only JPEG, PNG, WebP and AVIF images allowed";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "File must be under 5MB";
    }
    return null;
  };

  // ── Add files to queue ────────────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = maxPhotos - totalPhotos;
      if (remaining <= 0) {
        toast.error(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      const toAdd: UploadItem[] = [];
      for (const file of arr.slice(0, remaining)) {
        const err = validate(file);
        toAdd.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          status: err ? "error" : "pending",
          error: err ?? undefined,
        });
      }
      setItems((prev) => [...prev, ...toAdd]);
      // Auto-upload valid ones
      toAdd.filter((i) => i.status === "pending").forEach(uploadItem);
    },
    [totalPhotos, maxPhotos],
  );

  // ── Upload single item ────────────────────────────────────
  const uploadItem = async (item: UploadItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i)),
    );

    const ext = item.file.name.split(".").pop();
    const path = `${propertyId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, item.file, { contentType: item.file.type, upsert: false });

    if (uploadError) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "error", error: uploadError.message }
            : i,
        ),
      );
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Append to property.photos array in DB
    const newPhotos = [...existingPhotos, publicUrl];
    const { error: dbError } = await supabase
      .from("properties")
      .update({ photos: newPhotos })
      .eq("id", propertyId);

    if (dbError) {
      toast.error(`DB update failed: ${dbError.message}`);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "error", error: dbError.message }
            : i,
        ),
      );
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: "done", url: publicUrl } : i,
      ),
    );
    onPhotosChange?.(newPhotos);
    qc.invalidateQueries({ queryKey: ["properties"] });
    toast.success("Photo uploaded");
  };

  // ── Remove existing photo ─────────────────────────────────
  const removeExisting = async (url: string) => {
    setRemoving(url);
    try {
      // Extract path from public URL
      const path = url.split(`/storage/v1/object/public/${BUCKET}/`)[1];
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const newPhotos = existingPhotos.filter((u) => u !== url);
      await supabase
        .from("properties")
        .update({ photos: newPhotos })
        .eq("id", propertyId);
      onPhotosChange?.(newPhotos);
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Photo removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove photo");
    } finally {
      setRemoving(null);
    }
  };

  // Remove queued (not yet uploaded / failed)
  const removeQueued = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  // ── Drag and drop ─────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">
          Property Photos ({totalPhotos}/{maxPhotos})
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7"
          disabled={!canUpload}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={12} /> Upload
        </Button>
      </div>

      {/* Drop zone */}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/40 hover:bg-secondary/30"
          }`}
        >
          <ImageIcon size={24} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drag & drop photos here, or{" "}
            <span className="text-accent">click to browse</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            JPEG, PNG, WebP · Max 5MB each · {maxPhotos - totalPhotos} slots
            remaining
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* Photo grid */}
      {(existingPhotos.length > 0 || items.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {/* Existing photos */}
          {existingPhotos.map((url) => (
            <div
              key={url}
              className="relative group aspect-square rounded-xl overflow-hidden bg-secondary"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeExisting(url)}
                disabled={removing === url}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {removing === url ? (
                  <Loader2 size={10} className="animate-spin text-white" />
                ) : (
                  <X size={10} className="text-white" />
                )}
              </button>
              <div className="absolute bottom-1 left-1">
                <CheckCircle2 size={12} className="text-success drop-shadow" />
              </div>
            </div>
          ))}

          {/* Queued/uploading items */}
          {items.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square rounded-xl overflow-hidden bg-secondary"
            >
              <img
                src={item.preview}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Overlay by status */}
              {item.status === "uploading" && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-white" />
                </div>
              )}
              {item.status === "error" && (
                <div className="absolute inset-0 bg-destructive/40 flex flex-col items-center justify-center p-2">
                  <AlertTriangle size={16} className="text-white mb-1" />
                  <p className="text-[8px] text-white text-center leading-tight">
                    {item.error}
                  </p>
                </div>
              )}
              {item.status === "done" && (
                <div className="absolute bottom-1 left-1">
                  <CheckCircle2
                    size={12}
                    className="text-success drop-shadow"
                  />
                </div>
              )}

              {/* Remove button (not while uploading) */}
              {item.status !== "uploading" && (
                <button
                  onClick={() => removeQueued(item.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyImageUpload;
