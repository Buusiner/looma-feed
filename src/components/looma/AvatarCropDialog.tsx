import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AvatarCropDialogProps = {
  file: File | null;
  previewUrl: string | null;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type ImageBounds = ImageDimensions & {
  x: number;
  y: number;
};

type CropBox = {
  x: number;
  y: number;
  size: number;
};

const cropHandleDirections = [
  "north",
  "northEast",
  "east",
  "southEast",
  "south",
  "southWest",
  "west",
  "northWest",
] as const;

type CropHandle = (typeof cropHandleDirections)[number];

type CropInteraction = {
  clientX: number;
  clientY: number;
  cropBox: CropBox;
} & (
  | { kind: "move" }
  | {
      kind: "resize";
      handle: CropHandle;
    }
);

type CropInteractionStart = { kind: "move" } | { kind: "resize"; handle: CropHandle };

function getImageBounds(
  image: ImageDimensions,
  viewport: ImageDimensions,
  scale: number,
): ImageBounds {
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
  };
}

function clampCropBox(cropBox: CropBox, imageBounds: ImageBounds): CropBox {
  const maximumSize = Math.min(imageBounds.width, imageBounds.height);
  const minimumSize = Math.min(64, maximumSize);
  const size = Math.min(maximumSize, Math.max(minimumSize, cropBox.size));

  return {
    x: Math.min(imageBounds.x + imageBounds.width - size, Math.max(imageBounds.x, cropBox.x)),
    y: Math.min(imageBounds.y + imageBounds.height - size, Math.max(imageBounds.y, cropBox.y)),
    size,
  };
}

function resizeCropBox(
  cropBox: CropBox,
  handle: CropHandle,
  horizontalMovement: number,
  verticalMovement: number,
  imageBounds: ImageBounds,
): CropBox {
  let sizeMovement = 0;

  switch (handle) {
    case "north":
      sizeMovement = -verticalMovement;
      break;
    case "northEast":
      sizeMovement = Math.max(horizontalMovement, -verticalMovement);
      break;
    case "east":
      sizeMovement = horizontalMovement;
      break;
    case "southEast":
      sizeMovement = Math.max(horizontalMovement, verticalMovement);
      break;
    case "south":
      sizeMovement = verticalMovement;
      break;
    case "southWest":
      sizeMovement = Math.max(-horizontalMovement, verticalMovement);
      break;
    case "west":
      sizeMovement = -horizontalMovement;
      break;
    case "northWest":
      sizeMovement = Math.max(-horizontalMovement, -verticalMovement);
      break;
  }

  const size = cropBox.size + sizeMovement;
  const changesLeftEdge = handle === "west" || handle === "northWest" || handle === "southWest";
  const changesTopEdge = handle === "north" || handle === "northEast" || handle === "northWest";
  const changesOnlyVerticalEdge = handle === "north" || handle === "south";
  const changesOnlyHorizontalEdge = handle === "east" || handle === "west";

  return clampCropBox(
    {
      x: changesLeftEdge
        ? cropBox.x + cropBox.size - size
        : changesOnlyVerticalEdge
          ? cropBox.x + (cropBox.size - size) / 2
          : cropBox.x,
      y: changesTopEdge
        ? cropBox.y + cropBox.size - size
        : changesOnlyHorizontalEdge
          ? cropBox.y + (cropBox.size - size) / 2
          : cropBox.y,
      size,
    },
    imageBounds,
  );
}

/** Crops locally before the existing avatar upload flow sends the image to Supabase. */
export function AvatarCropDialog({ file, previewUrl, onCancel, onConfirm }: AvatarCropDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropInteractionRef = useRef<CropInteraction | null>(null);
  const [image, setImage] = useState<ImageDimensions | null>(null);
  const [viewport, setViewport] = useState<ImageDimensions | null>(null);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderedScale =
    image && viewport ? Math.min(viewport.width / image.width, viewport.height / image.height) : 1;

  useEffect(() => {
    setImage(null);
    setViewport(null);
    setCropBox(null);
    setIsCropping(false);
    setError(null);
  }, [file, previewUrl]);

  function handleImageLoad() {
    const element = imageRef.current;
    const cropViewport = viewportRef.current;
    if (!element || !cropViewport) return;

    const imageDimensions = { width: element.naturalWidth, height: element.naturalHeight };
    const viewportDimensions = {
      width: cropViewport.clientWidth,
      height: cropViewport.clientHeight,
    };
    const scale = Math.min(
      viewportDimensions.width / imageDimensions.width,
      viewportDimensions.height / imageDimensions.height,
    );
    const imageBounds = getImageBounds(imageDimensions, viewportDimensions, scale);
    const initialSize = Math.min(imageBounds.width, imageBounds.height);

    setImage(imageDimensions);
    setViewport(viewportDimensions);
    setCropBox({
      x: imageBounds.x + (imageBounds.width - initialSize) / 2,
      y: imageBounds.y + (imageBounds.height - initialSize) / 2,
      size: initialSize,
    });
  }

  function startInteraction(
    event: ReactPointerEvent<HTMLElement>,
    interaction: CropInteractionStart,
  ) {
    if (!cropBox || isCropping) return;
    event.preventDefault();
    event.stopPropagation();
    cropInteractionRef.current = {
      ...interaction,
      clientX: event.clientX,
      clientY: event.clientY,
      cropBox,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCropBox(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = cropInteractionRef.current;
    if (!interaction || !image || !viewport) return;

    const imageBounds = getImageBounds(image, viewport, renderedScale);
    const horizontalMovement = event.clientX - interaction.clientX;
    const verticalMovement = event.clientY - interaction.clientY;

    setCropBox(
      interaction.kind === "move"
        ? clampCropBox(
            {
              ...interaction.cropBox,
              x: interaction.cropBox.x + horizontalMovement,
              y: interaction.cropBox.y + verticalMovement,
            },
            imageBounds,
          )
        : resizeCropBox(
            interaction.cropBox,
            interaction.handle,
            horizontalMovement,
            verticalMovement,
            imageBounds,
          ),
    );
  }

  function endCropInteraction() {
    cropInteractionRef.current = null;
  }

  async function confirmCrop() {
    if (!file || !image || !viewport || !cropBox || !imageRef.current) return;

    setIsCropping(true);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      const outputSize = 512;
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar o recorte da imagem.");

      const imageBounds = getImageBounds(image, viewport, renderedScale);
      const sourceX = (cropBox.x - imageBounds.x) / renderedScale;
      const sourceY = (cropBox.y - imageBounds.y) / renderedScale;
      const sourceSize = cropBox.size / renderedScale;

      // The crop box is constrained to the displayed image, so Canvas exports
      // precisely the selected square without adding an interface mask or padding.
      context.drawImage(
        imageRef.current,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize,
      );

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não foi possível gerar o recorte da imagem.");

      onConfirm(new File([blob], "avatar-recortado.png", { type: "image/png" }));
    } catch (caught) {
      console.error("[Looma] Falha ao recortar avatar.", caught);
      setError(caught instanceof Error ? caught.message : "Não foi possível recortar a imagem.");
      setIsCropping(false);
    }
  }

  return (
    <Dialog open={Boolean(file && previewUrl)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="avatar-crop-dialog"
        showClose={false}
        aria-describedby="avatar-crop-description"
      >
        <DialogHeader>
          <DialogTitle>Mover e redimensionar</DialogTitle>
          <DialogDescription id="avatar-crop-description">
            Arraste e redimensione a caixa. A área selecionada será usada no seu perfil.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={viewportRef}
          className="avatar-crop-viewport"
          onPointerMove={moveCropBox}
          onPointerUp={endCropInteraction}
          onPointerCancel={endCropInteraction}
        >
          {previewUrl ? (
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Prévia para recortar"
              onLoad={handleImageLoad}
              draggable={false}
              style={
                image && viewport
                  ? {
                      width: image.width * renderedScale,
                      height: image.height * renderedScale,
                      transform: "translate(-50%, -50%)",
                    }
                  : undefined
              }
            />
          ) : null}
          {cropBox ? (
            <div
              className="avatar-crop-selection"
              style={{
                left: cropBox.x,
                top: cropBox.y,
                width: cropBox.size,
                height: cropBox.size,
              }}
              onPointerDown={(event) => startInteraction(event, { kind: "move" })}
            >
              {cropHandleDirections.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  className={`avatar-crop-handle avatar-crop-handle-${handle}`}
                  aria-label={`Redimensionar recorte pelo ${handle}`}
                  disabled={isCropping}
                  onPointerDown={(event) => startInteraction(event, { kind: "resize", handle })}
                />
              ))}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="avatar-crop-error" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="avatar-crop-actions">
          <button
            type="button"
            className="avatar-crop-cancel"
            onClick={onCancel}
            disabled={isCropping}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="avatar-crop-confirm"
            onClick={() => void confirmCrop()}
            disabled={!cropBox || isCropping}
          >
            {isCropping ? (
              <>
                <LoaderCircle size={16} /> Recortando…
              </>
            ) : (
              "Escolher"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
