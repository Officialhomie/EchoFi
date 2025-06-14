#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const publicDir = path.join(process.cwd(), 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create manifest.json
const manifest = {
  "name": "EchoFi - Decentralized Investment Coordination",
  "short_name": "EchoFi", 
  "description": "Transform group chats into investment DAOs with AI-powered execution",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066cc",
  "icons": [
    {
      "src": "/icon-192x192.svg",
      "sizes": "192x192",
      "type": "image/svg+xml"
    },
    {
      "src": "/icon-512x512.svg", 
      "sizes": "512x512",
      "type": "image/svg+xml"
    }
  ]
};

fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Create window.svg
const windowSvg = `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  <line x1="9" y1="9" x2="9" y2="21"/>
  <line x1="15" y1="9" x2="15" y2="21"/>
  <line x1="3" y1="9" x2="21" y2="9"/>
  <line x1="3" y1="15" x2="21" y2="15"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'window.svg'), windowSvg);

// Create icon placeholders
const icon192 = `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#0066cc" rx="20"/>
  <text x="96" y="105" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" font-weight="bold">EchoFi</text>
  <circle cx="96" cy="70" r="15" fill="white" opacity="0.8"/>
</svg>`;

const icon512 = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0066cc" rx="50"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="64" fill="white" text-anchor="middle" font-weight="bold">EchoFi</text>
  <circle cx="256" cy="180" r="40" fill="white" opacity="0.8"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon-192x192.svg'), icon192);
fs.writeFileSync(path.join(publicDir, 'icon-512x512.svg'), icon512);

console.log('✅ Created all missing public assets!');
console.log('📁 Files created:');
console.log('  - public/manifest.json');
console.log('  - public/window.svg');
console.log('  - public/icon-192x192.svg'); 
console.log('  - public/icon-512x512.svg');