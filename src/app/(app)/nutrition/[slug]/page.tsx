import { RecipePage } from "@/components/RecipePage";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <RecipePage slug={(await params).slug} />;
}
