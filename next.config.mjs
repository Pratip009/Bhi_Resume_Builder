/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer must run as a plain Node module, not bundled.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Make sure the bundled fonts ship with the PDF route on serverless hosts (e.g. Vercel).
  outputFileTracingIncludes: {
    "/api/export/pdf": ["./assets/fonts/**/*"],
  },
  poweredByHeader: false,
};

export default nextConfig;
