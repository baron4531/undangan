const esbuild = require('esbuild');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');

// Load .env for local development (ignored in Vercel — uses dashboard env vars)
const envFile = resolve(root, '.env');
if (existsSync(envFile)) {
    readFileSync(envFile, 'utf-8')
        .split('\n')
        .forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eq = trimmed.indexOf('=');
            if (eq === -1) return;
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            if (key) process.env[key] = val;
        });
}

const FIREBASE_KEYS = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_DATABASE_URL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
];

const define = {};
FIREBASE_KEYS.forEach((k) => {
    define[`process.env.${k}`] = JSON.stringify(process.env[k] ?? '');
});

const isWatch = process.argv.includes('--watch');

const config = {
    entryPoints: ['js/guest.js', 'js/admin.js'],
    bundle: true,
    minify: !isWatch,
    outdir: 'dist',
    define,
    absWorkingDir: root,
    target: ['chrome60', 'firefox60', 'safari11'],
};

if (isWatch) {
    esbuild.context(config).then((ctx) => ctx.watch());
} else {
    esbuild.build(config).then(() => console.log('Build complete.'));
}
