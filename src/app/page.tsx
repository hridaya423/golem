import { Golem } from "../experience/Golem";
import { HappyOysterProbe } from "../experience/HappyOysterProbe";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.operator === "1" && params.probe === "happy-oyster") return <HappyOysterProbe />;
  const mode =
    process.env.GOLEM_TEST_WORLD === "fake" && params.world !== "live" ? "fake" : "live";
  const operator = params.operator === "1";
  const compiler = params.compiler === "off" ? "off" : "on";
  const seed =
    params.seed === "fixture" || operator || mode === "fake" ? "fixture" : "none";
  const longTitle = operator && params.title === "long";
  return (
    <Golem
      mode={mode}
      operator={operator}
      compiler={compiler}
      seed={seed}
      longTitle={longTitle}
    />
  );
}
