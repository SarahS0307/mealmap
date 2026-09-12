import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Chips für den Plan. Jeder Mahlzeiten-Slot hat eine eigene Farbe aus dem
 * Moodboard, damit ein Tag auf einen Blick lesbar ist.
 *
 * `suggestion` ist bewusst gestrichelt und farblos: Vorschläge müssen sich
 * eindeutig von bestätigten Einträgen unterscheiden.
 */
const mealChipVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        breakfast: "bg-(--slot-breakfast) text-(--slot-breakfast-foreground)",
        snack: "bg-(--slot-snack) text-(--slot-snack-foreground)",
        lunch: "bg-(--slot-lunch) text-(--slot-lunch-foreground)",
        dinner: "bg-(--slot-dinner) text-(--slot-dinner-foreground)",
        other: "bg-muted text-muted-foreground",
        suggestion:
          "border-[1.5px] border-dashed border-muted-foreground/60 text-muted-foreground",
      },
    },
    defaultVariants: { variant: "other" },
  },
);

type MealChipProps = React.ComponentProps<"span"> &
  VariantProps<typeof mealChipVariants>;

export function MealChip({ className, variant, ...props }: MealChipProps) {
  return (
    <span className={cn(mealChipVariants({ variant }), className)} {...props} />
  );
}
