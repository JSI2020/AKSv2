/** Compact brand marks for the storefront sign-in channels. */

type IconProps = { className?: string; title?: string };

export function EmailChannelIcon({ className, title = "Email" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M3.5 5.75A1.75 1.75 0 0 1 5.25 4h13.5c.97 0 1.75.78 1.75 1.75v12.5A1.75 1.75 0 0 1 18.75 20H5.25A1.75 1.75 0 0 1 3.5 18.25V5.75Zm1.75-.25a.25.25 0 0 0-.25.25v.4l7 4.55 7-4.55v-.4a.25.25 0 0 0-.25-.25H5.25Zm13.5 2.84-6.66 4.33a.75.75 0 0 1-.82 0L4.6 8.34v9.91c0 .14.11.25.25.25h13.5a.25.25 0 0 0 .25-.25V8.34Z"
      />
    </svg>
  );
}

export function WhatsAppChannelIcon({
  className,
  title = "WhatsApp",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M12.04 2.01c-5.5 0-9.97 4.45-9.97 9.93 0 1.75.46 3.46 1.33 4.97L2 22l5.24-1.37a9.96 9.96 0 0 0 4.8 1.22h.01c5.5 0 9.97-4.46 9.97-9.94 0-2.66-1.04-5.16-2.92-7.04a9.9 9.9 0 0 0-7.06-2.86Zm0 1.8c2.16 0 4.2.84 5.73 2.37a8.07 8.07 0 0 1 2.38 5.76c0 4.5-3.66 8.15-8.15 8.15a8.1 8.1 0 0 1-4.14-1.14l-.3-.18-3.11.81.83-3.03-.19-.31a8.12 8.12 0 0 1-1.25-4.3c0-4.5 3.66-8.14 8.2-8.14Zm4.67 10.4c-.25-.13-1.5-.74-1.73-.82-.23-.09-.4-.13-.57.13-.17.25-.65.82-.8 1-.15.17-.3.2-.55.07-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.5.12-.12.25-.3.38-.45.13-.15.17-.25.25-.42.09-.17.04-.32-.02-.45-.06-.13-.57-1.37-.78-1.88-.2-.48-.41-.42-.57-.42h-.48c-.17 0-.45.06-.68.32-.23.25-.9.88-.9 2.14 0 1.26.92 2.48 1.05 2.65.13.17 1.81 2.76 4.38 3.87 1.72.74 2.15.8 2.92.67.47-.08 1.5-.61 1.71-1.2.21-.59.21-1.1.15-1.2-.07-.11-.23-.17-.48-.3Z"
      />
    </svg>
  );
}

export function FacebookChannelIcon({
  className,
  title = "Facebook",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M13.5 21v-7.2h2.4l.36-2.8h-2.76V9.2c0-.8.22-1.35 1.38-1.35H16.5V5.35C16.17 5.3 15.1 5.2 13.86 5.2c-2.58 0-4.35 1.57-4.35 4.46v2.49H7.2v2.8h2.31V21h4Z"
      />
    </svg>
  );
}

export function InstagramChannelIcon({
  className,
  title = "Instagram",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Zm6.1-8.15a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0ZM12 3.5c-2.3 0-2.59.01-3.5.05-2.2.1-3.4 1.3-3.5 3.5-.04.91-.05 1.2-.05 3.5s.01 2.59.05 3.5c.1 2.2 1.3 3.4 3.5 3.5.91.04 1.2.05 3.5.05s2.59-.01 3.5-.05c2.2-.1 3.4-1.3 3.5-3.5.04-.91.05-1.2.05-3.5s-.01-2.59-.05-3.5c-.1-2.2-1.3-3.4-3.5-3.5-.91-.04-1.2-.05-3.5-.05Zm0 1.7c2.26 0 2.53.01 3.42.05 1.64.07 2.4.85 2.48 2.48.04.89.05 1.16.05 3.42s-.01 2.53-.05 3.42c-.08 1.62-.84 2.4-2.48 2.48-.89.04-1.16.05-3.42.05s-2.53-.01-3.42-.05c-1.65-.08-2.4-.86-2.48-2.48-.04-.89-.05-1.16-.05-3.42s.01-2.53.05-3.42c.08-1.63.83-2.41 2.48-2.48.89-.04 1.16-.05 3.42-.05Z"
      />
    </svg>
  );
}

export function TikTokChannelIcon({ className, title = "TikTok" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M16.6 4.1c.7 1.5 1.9 2.7 3.5 3.3v2.4a7.1 7.1 0 0 1-3.5-1v6.4c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6c.3 0 .6 0 .9.1v2.5a3.5 3.5 0 1 0 2.6 3.4V3.5h2.5c0 .2 0 .4 0 .6Z"
      />
    </svg>
  );
}

export function GoogleChannelIcon({ className, title = "Google" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.07v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        d="M6.4 13.91a5.99 5.99 0 0 1 0-3.82V7.51H3.07a10 10 0 0 0 0 8.98l3.33-2.58Z"
      />
      <path
        fill="currentColor"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.97 14.7 2 12 2A10 10 0 0 0 3.07 7.51l3.33 2.58C7.19 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}
