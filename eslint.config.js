// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions run on Deno and are checked by Supabase at deploy.
    ignores: ['dist/*', 'supabase/functions/*'],
  },
]);
