"use client";

import { useRef, useState } from "react";
import { Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  generateFabricPhotoAction,
  uploadPhotorealFilesAction,
} from "../../actions";

import {
  EmptyOutput,
  PanelHead,
  StudioDropzone,
  ThumbRow,
  Workbench,
  studioFieldClass,
  studioLabelClass,
  useStudioToast,
} from "./studio-primitives";

const LIGHTING = ["Even daylight", "Soft north-light", "Diffuse studio"];
const BACKGROUNDS = ["Neutral grey", "Soft white", "Cool stone", "Deep charcoal"];

export function FabricTab() {
  const toast = useStudioToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [swatchUrl, setSwatchUrl] = useState("");
  const [lighting, setLighting] = useState("Even daylight");
  const [background, setBackground] = useState("Neutral grey");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleUpload = async (files: FileList) => {
    const file = files[0];
    if (!file?.type.startsWith("image/")) return;
    setPreview(URL.createObjectURL(file));
    setResultUrl(null);
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("kind", "sketch");
      form.append("files", file);
      const res = await uploadPhotorealFilesAction(form);
      if (!res.ok || !res.files?.[0]) {
        throw new Error(!res.ok ? res.error : "Upload failed.");
      }
      setSwatchUrl(res.files[0].url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!swatchUrl) {
      setError(
        uploading
          ? "Swatch is still uploading — wait a moment."
          : "Upload a fabric photo first.",
      );
      return;
    }

    setBusy(true);
    setError(null);
    setResultUrl(null);

    try {
      const data = await generateFabricPhotoAction({
        swatchUrl,
        lighting,
        background,
      });
      if (!data.ok) throw new Error(data.error);
      setResultUrl(data.imageUrl);
      toast("Fabric photograph ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSwatchUrl("");
    setResultUrl(null);
    setError(null);
    toast("Cleared");
  };

  return (
    <Workbench
      input={
        <div>
          <PanelHead label="Fabric" step="01" />

          <p className="mb-5 text-[13px] leading-relaxed text-chalk">
            Upload a flat swatch photo. The studio returns{" "}
            <span className="font-semibold text-greige">
              one catalogue photograph
            </span>{" "}
            — same colour, same weave, styled as a spiral drape.
          </p>

          <div className="mb-5">
            <span className={studioLabelClass}>Fabric photo</span>
            <StudioDropzone
              label="Drop a fabric photo"
              sublabel="One swatch · PNG, JPG, WEBP"
              disabled={busy || uploading}
              onChoose={() => inputRef.current?.click()}
              inputRef={inputRef}
              onFileChange={(files) => void handleUpload(files)}
              onDrop={(files) => void handleUpload(files)}
            />
            {preview && (
              <ThumbRow
                assets={[{ localPreview: preview, name: "Swatch" }]}
                onRemove={() => {
                  URL.revokeObjectURL(preview);
                  setPreview(null);
                  setSwatchUrl("");
                  setResultUrl(null);
                }}
              />
            )}
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={studioLabelClass} htmlFor="fab-light">
                Lighting
              </label>
              <select
                id="fab-light"
                className={studioFieldClass}
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                disabled={busy}
              >
                {LIGHTING.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={studioLabelClass} htmlFor="fab-bg">
                Background
              </label>
              <select
                id="fab-bg"
                className={studioFieldClass}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                disabled={busy}
              >
                {BACKGROUNDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="mb-4 text-[13px] text-madder" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-5 border-t border-indigo-lift pt-5">
            <Button
              type="button"
              disabled={busy || uploading || !swatchUrl}
              className="rounded-[2px] border border-zari bg-zari text-[13.5px] text-indigo hover:bg-zari/90"
              onClick={() => void handleGenerate()}
            >
              <Sparkles className="size-4" />
              {busy ? "Generating…" : uploading ? "Uploading…" : "Generate photograph"}
            </Button>
            <button
              type="button"
              className="text-[13px] text-chalk hover:text-greige"
              disabled={busy}
              onClick={clearAll}
            >
              Clear
            </button>
          </div>
        </div>
      }
      output={
        <div>
          <PanelHead label="Photograph" step="02" />
          {!resultUrl ? (
            <EmptyOutput
              title="Your fabric photograph appears here"
              subtitle="Upload a swatch and press Generate. One styled catalogue shot — same colour and fabric as your upload."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {preview && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-chalk">
                      Your upload
                    </p>
                    <div className="aspect-square overflow-hidden border border-indigo-lift rounded-[2px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt="Uploaded swatch"
                        className="size-full object-cover"
                      />
                    </div>
                  </div>
                )}
                <div className={preview ? "" : "sm:col-span-2"}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-zari">
                    Catalogue photograph
                  </p>
                  <div className="aspect-square overflow-hidden border border-zari/40 rounded-[2px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultUrl}
                      alt="Fabric catalogue photograph"
                      className="size-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11.5px] text-chalk">
                Compare colour and weave side by side. Neutral backgrounds and
                even daylight preserve swatch tone best — avoid warm-paper if
                your grey is shifting beige.
              </p>
              <a
                href={resultUrl}
                download="fabric-catalogue.png"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-zari px-4 py-2 text-[13px] font-semibold text-zari rounded-[2px] hover:bg-indigo-lift"
              >
                <Download className="size-4" />
                Download catalogue photograph
              </a>
            </div>
          )}
        </div>
      }
    />
  );
}
