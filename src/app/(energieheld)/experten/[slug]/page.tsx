import { redirect } from "next/navigation";

export default async function LegacyExpertDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/unterkuenfte/${encodeURIComponent(slug)}`);
}
