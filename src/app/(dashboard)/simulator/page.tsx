import { Simulator } from "@/components/simulator/simulator";

export default function SimulatorPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          What-If Simulator
        </h1>
        <p className="text-sm text-muted-foreground">
          Preview effective permissions, inherited roles, and active policies
          for any role
        </p>
      </div>
      <Simulator />
    </div>
  );
}
