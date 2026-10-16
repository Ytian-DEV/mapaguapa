import { useRef, useState } from "react";
import { Grid2x2, ImageOff } from "lucide-react";
import { publicPhotoUrl } from "../../lib/photos";
import { Dialog } from "../../ui";
import type { ListingPhoto } from "./detailApi";

type Photo = { id: string; url: string; alt: string };

function toPhotos(photos: ListingPhoto[], listingName: string): Photo[] {
  return photos
    .map((photo, index) => ({
      id: photo.id,
      url: publicPhotoUrl(photo.storage_bucket, photo.storage_path),
      alt: photo.alt_text?.trim() || photo.caption?.trim() || `${listingName} photo ${index + 1}`,
    }))
    .filter((photo) => photo.url);
}

function Tile({ photo, eager, onOpen, className }: { photo: Photo; eager?: boolean; onOpen: () => void; className?: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  return (
    <button aria-label={`Open photos: ${photo.alt}`} className={`gallery__tile ${className ?? ""}`} onClick={onOpen} type="button">
      {state === "failed" ? (
        <span className="gallery__fallback" aria-hidden="true">
          <ImageOff />
        </span>
      ) : (
        <img
          alt=""
          className={state === "loaded" ? "is-loaded" : undefined}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          onError={() => setState("failed")}
          onLoad={() => setState("loaded")}
          src={photo.url}
        />
      )}
    </button>
  );
}

/** Frame 03 gallery: one large photo + 2×2 grid on desktop, swipe carousel on phones. */
export function PhotoGallery({ photos: rawPhotos, listingName }: { photos: ListingPhoto[]; listingName: string }) {
  const photos = toPhotos(rawPhotos, listingName);
  const [open, setOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const photoRefs = useRef<Array<HTMLElement | null>>([]);

  const openAt = (index: number) => {
    setOpen(true);
    window.setTimeout(() => photoRefs.current[index]?.scrollIntoView({ block: "start" }), 50);
  };

  if (photos.length === 0) {
    return (
      <div className="gallery gallery--empty">
        <ImageOff aria-hidden="true" />
        <p>No photos yet</p>
      </div>
    );
  }

  const [first, ...rest] = photos;
  const side = rest.slice(0, 4);

  return (
    <>
      <div className={`gallery gallery--count-${Math.min(photos.length, 5)}`}>
        <Tile className="gallery__main" eager onOpen={() => openAt(0)} photo={first} />
        {side.map((photo, index) => (
          <Tile key={photo.id} onOpen={() => openAt(index + 1)} photo={photo} />
        ))}
        {photos.length > 1 && (
          <button className="gallery__all" onClick={() => openAt(0)} type="button">
            <Grid2x2 aria-hidden="true" />
            Show all {photos.length} photos
          </button>
        )}
      </div>

      {/* Phones: horizontal scroll-snap carousel with a counter. */}
      <div className="gallery-carousel">
        <div
          aria-label={`${listingName} photos`}
          className="gallery-carousel__track"
          onScroll={(event) => {
            const track = event.currentTarget;
            setCarouselIndex(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1)));
          }}
          role="region"
          tabIndex={0}
        >
          {photos.map((photo, index) => (
            <Tile eager={index === 0} key={photo.id} onOpen={() => openAt(index)} photo={photo} />
          ))}
        </div>
        <span aria-live="polite" className="gallery-carousel__count">
          {Math.min(carouselIndex + 1, photos.length)} / {photos.length}
        </span>
      </div>

      <Dialog className="gallery-dialog" onClose={() => setOpen(false)} open={open} size="lg" title={`${listingName} · ${photos.length} photos`}>
        <div className="gallery-dialog__list">
          {photos.map((photo, index) => (
            <figure
              className="gallery-dialog__item"
              key={photo.id}
              ref={(node) => {
                photoRefs.current[index] = node;
              }}
            >
              <img alt={photo.alt} loading={index < 2 ? "eager" : "lazy"} src={photo.url} />
              {rawPhotos[index]?.caption?.trim() && <figcaption>{rawPhotos[index].caption}</figcaption>}
            </figure>
          ))}
        </div>
      </Dialog>
    </>
  );
}
