"use client"

import type { PropsWithChildren } from "react"
import { Children } from "react"

import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper"

export function StepperComponent({ children }: PropsWithChildren) {
  const length = Children.count(children)

  return (
    <div className="flex items-center justify-center">
      <Stepper
        className="flex flex-col items-center justify-center gap-10"
        orientation="vertical"
        defaultValue={0}
      >
        <StepperNav>
          {Children.map(children, (step, index) => (
            <StepperItem
              key={index}
              step={index + 1}
              className="relative items-start not-last:flex-1"
            >
              <StepperTrigger className="items-start gap-2.5 pb-12 last:pb-0">
                <StepperIndicator className="data-[state=completed]:bg-foreground data-[state=completed]:text-white">
                  {index + 1}
                </StepperIndicator>
                {step}
              </StepperTrigger>
              {index < length - 1 && (
                <StepperSeparator className="group-data-[state=completed]/step:bg-success absolute inset-y-0 top-7 left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2rem)]" />
              )}
            </StepperItem>
          ))}
        </StepperNav>
      </Stepper>
    </div>
  )
}

export function StepperItemComponent({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="mt-0.5 text-left">
      <StepperTitle className="mt-0!">{title}</StepperTitle>
      <StepperDescription>{children}</StepperDescription>
    </div>
  )
}
