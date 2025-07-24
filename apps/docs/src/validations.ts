import z from "zod"

import { allowedIcons } from "./lib/icon"

export const frontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  navTitle: z.string().optional(),
  entrypoint: z.string().optional(),
  alias: z.string().optional(),
  showToc: z.boolean().optional().default(true),
})

export const headingSchema = z.array(
  z.object({
    level: z.number(),
    text: z.string(),
    id: z.string(),
  }),
)

export const docSchema = {
  frontmatter: frontmatterSchema,
  headings: headingSchema,
}

export const featuresSchema = z.object({
  title: z.string(),
  icon: z.enum(Object.keys(allowedIcons), {
    error: (value) =>
      `Icon "${String(value.input)}" is not specified. Please add it to the "icon.tsx".`,
  }),
  type: z.enum(["feature", "key_feature"]),
})
