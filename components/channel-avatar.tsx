"use client";

import { useState } from "react";
import Image from "next/image";
import { Radio, Send } from "lucide-react";
import type { Channel } from "../lib/dashboard";

type ChannelAvatarProps = {
  channel: Pick<Channel, "id" | "type">;
  size?: number;
  className?: string;
};

export function ChannelAvatar({
  channel,
  size = 38,
  className = "",
}: ChannelAvatarProps) {
  const [unavailable, setUnavailable] = useState(false);
  const FallbackIcon = channel.type === "source" ? Radio : Send;

  return (
    <span
      className={`channel-avatar ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {unavailable ? (
        <FallbackIcon size={Math.max(14, Math.round(size * 0.45))} />
      ) : (
        <Image
          src={`/api/channels/${encodeURIComponent(channel.id)}/avatar`}
          alt=""
          width={size}
          height={size}
          unoptimized
          loading="lazy"
          onError={() => setUnavailable(true)}
        />
      )}
    </span>
  );
}
