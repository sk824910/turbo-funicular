import partytown from '@astrojs/partytown';
import i18n from '@astrolicious/i18n';
import tailwindcss from "@tailwindcss/vite";
import icon from 'astro-icon';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	// build: {
  //   rollupOptions: {
  //     external: [
  //       /^node:.*/,
  //     ]
  //   }},
  trailingSlash:"ignore",
  output: 'static',
  build: {
    minify: true, // Enables Terser for JS minification
    sourcemap: false, // Avoid generating source maps unless debugging
    format: "directory",
  },
  
  // adapter: cloudflare(),
  integrations: [
    // starlight({
    //   head: [
    //     // Adding google analytics
    //     {
    //       tag: 'script',
    //       attrs: {
    //         src: `https://www.googletagmanager.com/gtag/js?id=G-HX4B9QTK3G`,
    //       },
    //     },
    //     {
    //       tag: 'script',
    //       content: `
    //        window.dataLayer = window.dataLayer || [];
    //       function gtag() { 
    //         dataLayer.push(arguments);
    //       }
    //       gtag("js", new Date());

    //       gtag("config", "G-HX4B9QTK3G");
    //       `,
    //     },
    //   ],
    // }),
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    icon(),
    i18n({
      defaultLocale: 'en',
      locales: ['fr', 'en', 'es'],
      client: {
        data: true,
      },
      routing: "manual"
    }),
    react(),
  ],
  vite: {
    build: {
      chunkSizeWarningLimit: 1500,
    },
    plugins: [tailwindcss()],
 
  },

	experimental: {
		svg: true,
	},
  
});
