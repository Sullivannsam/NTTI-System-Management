import React from "react";
import clsx from "clsx";

export default function Avatar({ name, color, photo, size = "md", className }) {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const sizes = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  };

  return (
    <div
      className={clsx(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full font-semibold text-white shrink-0",
        sizes[size],
        className
      )}
      style={{ background: color || "#6366f1" }}
    >
      {photo ? (
        <img src={photo} alt={name || "avatar"} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}