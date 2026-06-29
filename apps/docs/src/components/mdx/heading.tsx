import { Space_Grotesk } from "next/font/google"
import type { ElementType, JSX, ReactNode } from "react"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

type IntrinsicElement = keyof JSX.IntrinsicElements
type PolymorphicComponentProps<T extends IntrinsicElement> = {
  as?: T
} & JSX.IntrinsicElements[T]

const PolymorphicComponent = <T extends IntrinsicElement>({
  as: elementType = "div" as T,
  ...rest
}: PolymorphicComponentProps<T>) => {
  const Component = elementType as ElementType
  return <Component {...rest} />
}

export function Heading({
  level,
  id,
  children,
}: {
  level: number
  id: string
  children: ReactNode
}) {
  return (
    <PolymorphicComponent
      as={`h${level}` as IntrinsicElement}
      id={id}
      className="group no-underline hover:no-underline [&_a]:no-underline"
      style={{ fontFamily: spaceGrotesk.style.fontFamily }}
    >
      {children}{" "}
      <a
        href={`#${id}`}
        className="hidden no-underline group-hover:inline-block"
        data-pagefind-ignore
      >
        #
      </a>
    </PolymorphicComponent>
  )
}
