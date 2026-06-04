"use client";

import { useState } from "react";

// Landscape photos are cropped to fill the banner (as before). Portrait photos
// would be ugly cropped, so instead they're shown centered at full height with
// a blurred copy of the photo filling the empty space on the sides.
export default function RecipeImage({ src, alt }: { src: string; alt: string }) {
  const [portrait, setPortrait] = useState(false);

  return (
    <div className="relative mt-6 h-96 w-full overflow-hidden rounded-xl bg-stone-100">
      {portrait ? (
        // Blurred backdrop fills the side gaps with the photo's own colors.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={(e) => {
          const img = e.currentTarget;
          setPortrait(img.naturalHeight > img.naturalWidth);
        }}
        className={`relative mx-auto h-full ${portrait ? "w-auto object-contain" : "w-full object-cover"}`}
      />
    </div>
  );
}
