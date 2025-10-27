import createMDXPlugin from "@next/mdx"

const withMDX = createMDXPlugin({
  options: {
    rehypePlugins: [
      "@renoun/mdx/rehype/add-code-block",
      "@renoun/mdx/rehype/add-reading-time",
      "rehype-mdx-import-media",
    ],
    remarkPlugins: [
      "@renoun/mdx/remark/add-headings",
      "remark-frontmatter",
      "remark-mdx-frontmatter",
      "remark-squeeze-paragraphs",
      "@renoun/mdx/remark/remove-immediate-paragraphs",
      "remark-strip-badges",
      "@renoun/mdx/remark/transform-relative-links",
      "remark-gfm",
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  poweredByHeader: false,
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@vorsteh-queue/core",
    "@vorsteh-queue/adapter-drizzle",
    "@vorsteh-queue/adapter-prisma",
    "@vorsteh-queue/adapter-kysely",
    "create-vorsteh-queue",
  ],

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default withMDX(nextConfig)
