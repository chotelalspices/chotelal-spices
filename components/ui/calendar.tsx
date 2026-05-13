import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/libs/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-3",
        month_caption: "relative flex h-8 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "absolute right-2 top-2 flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        chevron: "h-4 w-4",
        month_grid: "w-full table-fixed border-collapse",
        weekdays: "border-b",
        weekday: "h-8 w-9 text-center text-[0.8rem] font-normal text-muted-foreground",
        week: "border-0",
        day: "h-9 w-9 p-0 text-center text-sm",
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal"),
        range_end: "[&>button]:rounded-r-md",
        range_middle: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        range_start: "[&>button]:rounded-l-md",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside:
          "[&>button]:text-muted-foreground [&>button]:opacity-50 data-[selected=true]:[&>button]:bg-accent/50 data-[selected=true]:[&>button]:text-muted-foreground",
        disabled: "[&>button]:text-muted-foreground [&>button]:opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, disabled }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("h-4 w-4", disabled && "opacity-50", className)} />;
        },
      } as React.ComponentProps<typeof DayPicker>["components"]}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
