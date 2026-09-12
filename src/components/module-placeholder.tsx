import { MealChip } from "@/components/meal-chip";

type ChipVariant = React.ComponentProps<typeof MealChip>["variant"];

type ModulePlaceholderProps = {
  title: string;
  description: string;
  phase: string;
  upcoming: string[];
  chips?: { label: string; variant: ChipVariant }[];
};

export function ModulePlaceholder({
  title,
  description,
  phase,
  upcoming,
  chips,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl">{title}</h1>
        <p className="max-w-prose text-muted-foreground">{description}</p>
      </div>

      {chips ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <MealChip key={chip.label} variant={chip.variant}>
              {chip.label}
            </MealChip>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-dashed border-border bg-card/60 p-5">
        <p className="text-sm font-semibold">Noch nicht gebaut – {phase}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          {upcoming.map((entry) => (
            <li key={entry} className="flex gap-2">
              <span aria-hidden="true">–</span>
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
