import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/gotenberg-api': {
                target: 'https://advgotenberg.advancedhealth.com.co',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/gotenberg-api/, ''),
                secure: false,
                timeout: 300000,
                proxyTimeout: 300000,
                // Add explicit headers and agent configuration for stability
                headers: {
                    Connection: 'keep-alive'
                }
            }
        }
    }
});
