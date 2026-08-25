export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-block-size-full bg-greige text-ink text-[14px] leading-normal">
      {children}
    </div>
  );
}
