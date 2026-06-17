// components/PlayerAvatar.tsx
"use client";

import Image from "next/image";
import { useState } from "react";

export default function PlayerAvatar({ name, imageUrl }: { name: string; imageUrl: string }) {
  const [src, setSrc] = useState(imageUrl);

  return (
    <Image
      src={src}
      alt={name}
      fill
      className="object-cover"
      sizes="48px"
      unoptimized
      onError={() => {
        // Automatically switch to Dicebear initials if the local image is missing
        setSrc(`https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=171717&textColor=a3a3a3`);
      }}
    />
  );
}