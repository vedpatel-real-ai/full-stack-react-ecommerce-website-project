import {defineConfig} from 'vite';
export default defineConfig({envPrefix:'FOLIO_PUBLIC_UNUSED_',worker:{format:'es'},optimizeDeps:{exclude:['@electric-sql/pglite','@electric-sql/pglite/worker']},build:{sourcemap:false}});
