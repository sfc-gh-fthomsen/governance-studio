import { readConfig } from "@/lib/config";
import { redirect } from "next/navigation";

export default async function Home() {
  const config = await readConfig();
  const hasEnvConfig = !!(
    process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER
  );

  if (!config && !hasEnvConfig) {
    redirect("/setup");
  }
  redirect("/roles");
}
