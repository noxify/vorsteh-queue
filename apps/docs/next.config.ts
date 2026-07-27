import createMDXPlugin from "@next/mdx"
import type { NextConfig } from "next"

function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) {
    return ""
  }

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`

  if (withLeadingSlash === "/") {
    return ""
  }

  return withLeadingSlash.replace(/\/+$/u, "")
}

// oxlint-disable-next-line no-restricted-properties
const basePath = normalizeBasePath(process.env.BASE_PATH)

const withMDX = createMDXPlugin({
  options: {
    rehypePlugins: [
      "@renoun/mdx/rehype/add-code-block",
      "@renoun/mdx/rehype/add-reading-time",
      "rehype-mdx-import-media",
    ],
    remarkPlugins: [
      "@renoun/mdx/remark/add-sections",
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

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        assetPrefix: basePath,
        basePath,
      }
    : {}),
  images: {
    unoptimized: true,
  },
  output: "export",
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  poweredByHeader: false,
  reactStrictMode: true,
  // staticPageGenerationTimeout: 180,

  trailingSlash: true,
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
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: false,
  experimental: {
    cpus: 1,
    serverSourceMaps: false,
  },
}

export default withMDX(nextConfig)
