"use client";

import { useEffect, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { cloudMediaPath, createCloudMediaUrl } from "@/lib/cloud";

function useCloudMediaUrl(source?: string) {
  const [resolved, setResolved] = useState(source ?? "");

  useEffect(() => {
    let active = true;
    if (!source || !cloudMediaPath(source)) {
      setResolved(source ?? "");
      return () => { active = false; };
    }

    setResolved("");
    createCloudMediaUrl(source)
      .then((url) => { if (active) setResolved(url); })
      .catch(() => { if (active) setResolved(""); });
    return () => { active = false; };
  }, [source]);

  return resolved;
}

type CloudImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string };

export function CloudImage({ src, alt = "", ...props }: CloudImageProps) {
  const resolved = useCloudMediaUrl(src);
  if (!resolved) return <span className="cloud-media-loading" aria-label="Loading photo">Photo</span>;
  return <img {...props} src={resolved} alt={alt} />;
}

type CloudMediaLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export function CloudMediaLink({ href, children, ...props }: CloudMediaLinkProps) {
  const resolved = useCloudMediaUrl(href);
  if (!resolved) return <span className={props.className}>Preparing photo</span>;
  return <a {...props} href={resolved}>{children}</a>;
}
