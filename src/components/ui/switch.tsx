"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center rounded-full outline-none before:absolute before:inset-x-0 before:top-2 before:h-7 before:rounded-full before:border before:transition-colors focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:before:border-primary data-[state=checked]:before:bg-primary data-[state=unchecked]:before:border-input data-[state=unchecked]:before:bg-surface-2",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none relative z-10 block size-5 translate-x-1 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[1.625rem]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
