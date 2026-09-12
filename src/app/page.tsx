import { AnythingPlay } from "../experience/AnythingPlay";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode =
    params.world === "fake" || process.env.NEXT_PUBLIC_WORLD === "fake" ? "fake" : "live";
  const operator = params.operator === "1";
  const compiler = params.compiler === "off" ? "off" : "on";
  return <AnythingPlay mode={mode} operator={operator} compiler={compiler} />;
}
