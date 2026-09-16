import { DirectoryPage } from "@/components/portal/directory-page";
export const metadata = { title: "Experten A–Z" };
export default function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DirectoryPage searchParams={searchParams} />;
}
