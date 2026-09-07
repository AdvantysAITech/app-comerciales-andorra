export default function LayoutDocumento({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-lienzo">{children}</div>;
}