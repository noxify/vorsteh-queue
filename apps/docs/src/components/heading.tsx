import type { ElementType, JSX, ReactNode } from "react"

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
    <PolymorphicComponent as={`h${level}` as IntrinsicElement} id={id} className="group">
      {children}{" "}
      <a href={`#${id}`} className="hidden no-underline group-hover:inline-block">
        #
      </a>
    </PolymorphicComponent>
  )
}
