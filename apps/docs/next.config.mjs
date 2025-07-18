import createMDXPlugin from "@next/mdx"
import { rehypePlugins, remarkPlugins } from "renoun/mdx"

const withMDX = createMDXPlugin({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins,
    rehypePlugins,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  poweredByHeader: false,
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}

export default withMDX(nextConfig)
