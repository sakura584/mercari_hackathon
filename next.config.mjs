/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 auto-generates AGENTS.md/CLAUDE.md on `next dev`; this repo
  // manages its own CLAUDE.md conventions, so disable the auto-generation.
  agentRules: false,
};

export default nextConfig;
