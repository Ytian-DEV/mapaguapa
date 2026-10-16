import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { publicPhotoUrl } from "../../lib/photos";
import { Badge, Button, ConfirmDialog, Input, useToast } from "../../ui";
import { MAX_PHOTOS, deletePhoto, savePhotoOrder, updatePhotoAlt, uploadPhoto, type WizardMode, type WizardPhoto } from "./wizardApi";
import { MIN_PHOTOS } from "./wizardModel";

type PhotosStepProps = {
  listingId: string | null;
  mode: WizardMode;
  photos: WizardPhoto[];
  onPhotosChange: (photos: WizardPhoto[]) => void;
  /** Creates the draft if needed so uploads have a listing to attach to. */
  ensureListing: () => Promise<string | null>;
};

type Upload = { name: string; state: "uploading" | "failed"; error?: string };

/** Step 7: upload to listing-photos, reorder, choose cover (first photo), alt text. */
export function PhotosStep({ listingId, mode, photos, onPhotosChange, ensureListing }: PhotosStepProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<WizardPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const id = listingId ?? (await ensureListing());
    if (!id) {
      toast.error("Add a listing name in Basics first so we can save your photos.");
      return;
    }
    const room = MAX_PHOTOS - photosRef.current.length;
    const files = Array.from(list).slice(0, Math.max(room, 0));
    if (files.length < list.length) toast.show(`You can add up to ${MAX_PHOTOS} photos.`);

    setUploads(files.map((file) => ({ name: file.name, state: "uploading" })));
    const current = [...photosRef.current];
    for (const file of files) {
      try {
        const photo = await uploadPhoto(id, mode, file, current.length, current.length === 0);
        current.push(photo);
        onPhotosChange([...current]);
        setUploads((items) => items.filter((item) => item.name !== file.name));
      } catch (error) {
        setUploads((items) =>
          items.map((item) => (item.name === file.name ? { ...item, state: "failed", error: error instanceof Error ? error.message : "Upload failed" } : item))
        );
      }
    }
  };

  const reorder = async (next: WizardPhoto[]) => {
    const previous = photosRef.current;
    onPhotosChange(next.map((photo, index) => ({ ...photo, sort_order: index, is_cover: index === 0 })));
    try {
      await savePhotoOrder(next);
    } catch {
      onPhotosChange(previous);
      toast.error("Couldn’t save the new order.");
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    void reorder(next);
  };

  const makeCover = (index: number) => {
    const next = [...photos];
    const [photo] = next.splice(index, 1);
    void reorder([photo, ...next]);
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deletePhoto(confirmDelete);
      const rest = photosRef.current.filter((photo) => photo.id !== confirmDelete.id);
      onPhotosChange(rest);
      if (rest.length > 0 && confirmDelete.is_cover) await savePhotoOrder(rest);
      setConfirmDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t delete the photo.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="wizard-section">
      <div className="wizard-section__head">
        <h2>Photos</h2>
        <p>
          Add at least {MIN_PHOTOS}: the outside, a room, the comfort room and shared areas. The first photo is the cover. Large photos are
          resized before upload.
        </p>
      </div>

      <label className="photo-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}>
        <ImagePlus aria-hidden="true" />
        <span>
          <strong>Choose photos</strong> or drop them here · {photos.length}/{MAX_PHOTOS}
        </span>
        <input
          accept="image/*"
          className="v2-sr-only"
          multiple
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
          ref={fileRef}
          type="file"
        />
      </label>

      {uploads.length > 0 && (
        <ul aria-live="polite" className="photo-uploads">
          {uploads.map((upload) => (
            <li className={upload.state === "failed" ? "is-failed" : undefined} key={upload.name}>
              {upload.state === "uploading" ? `Uploading ${upload.name}…` : `${upload.name}: ${upload.error}`}
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ol className="photo-grid">
          {photos.map((photo, index) => (
            <li className="photo-tile" key={photo.id}>
              <div className="photo-tile__img">
                <img alt={photo.alt_text ?? ""} loading="lazy" src={publicPhotoUrl(photo.storage_bucket, photo.storage_path)} />
                {index === 0 && (
                  <Badge className="photo-tile__cover" icon={<Star />} tone="green">
                    Cover
                  </Badge>
                )}
              </div>
              <div className="photo-tile__tools">
                <Button aria-label="Move earlier" disabled={index === 0} iconOnly onClick={() => move(index, -1)} size="sm" variant="ghost">
                  <ArrowLeft />
                </Button>
                <Button aria-label="Move later" disabled={index === photos.length - 1} iconOnly onClick={() => move(index, 1)} size="sm" variant="ghost">
                  <ArrowRight />
                </Button>
                {index !== 0 && (
                  <Button onClick={() => makeCover(index)} size="sm" variant="ghost">
                    Make cover
                  </Button>
                )}
                <Button aria-label="Delete photo" iconOnly onClick={() => setConfirmDelete(photo)} size="sm" variant="ghost">
                  <Trash2 />
                </Button>
              </div>
              <Input
                aria-label={`Describe photo ${index + 1}`}
                defaultValue={photo.alt_text ?? ""}
                onBlur={(event) => {
                  if ((photo.alt_text ?? "") !== event.target.value) void updatePhotoAlt(photo.id, event.target.value);
                }}
                placeholder="Describe it (e.g. Room for 2)"
              />
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        busy={deleting}
        confirmLabel="Delete photo"
        description="It will be removed from your listing and from storage."
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void remove()}
        open={confirmDelete !== null}
        title="Delete this photo?"
      />
    </section>
  );
}
