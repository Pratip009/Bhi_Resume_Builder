/** @type {import('next').NextConfig} */

// Files the export routes read at runtime that Next's file tracer can't detect:
// - our bundled TTFs (read via process.cwd())
// - pdfkit's built-in fonts, which it loads through a package.json "imports" alias
//   ("#standard-fonts/Helvetica"). pdfkit loads Helvetica as the default font for every
//   document, so without these every PDF render crashes in production. The Word route
//   uses the PDF engine to measure the one-page fit, so it crashed too.
const exportFiles = [
  "./assets/fonts/**/*",
  "./node_modules/pdfkit/package.json",
  "./node_modules/pdfkit/js/**/*",
];

const nextConfig = {
  // @react-pdf/renderer must run as a plain Node module, not bundled.
  serverExternalPackages: ["@react-pdf/renderer", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/export/pdf": exportFiles,
    "/api/export/docx": exportFiles,
  },
  poweredByHeader: false,
};

export default nextConfig;
