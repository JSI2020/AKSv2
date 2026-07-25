export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-block-size-full bg-indigo text-greige text-[13px] leading-normal">
      {children}
    </div>
  );
}
