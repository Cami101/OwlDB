import { defineConfig } from "cypress";

export default defineConfig({
  projectId: 'undy4r',
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  baseUrl: 'http://localhost:1234',
  includeShadowDom: true,
  },
});
