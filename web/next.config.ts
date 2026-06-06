import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il core è TypeScript condiviso via workspace: va transpilato da Next.
  transpilePackages: ["@unidesk/core"],
  // Il core usa import in stile NodeNext (`./x.js`): mappa `.js` su `.ts` così
  // il bundler di Next risolve i sorgenti TypeScript del workspace.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
