import { RoutinePlayer } from "@/components/Movement";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <RoutinePlayer slug={(await params).slug} />;
}
