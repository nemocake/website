/**
 * Site Configuration Loader
 * Fetches config from /data/config.json and makes it available globally
 * Falls back to localStorage if fetch fails (offline support)
 */

(function() {
  'use strict';

  // IMMEDIATELY initialize SITE_CONFIG from localStorage (synchronous)
  // This ensures config is always available, even before fetch completes
  try {
    const cached = localStorage.getItem('conradSiteConfig');
    if (cached) {
      window.SITE_CONFIG = JSON.parse(cached);
      console.log('[Config Loader] Initialized from localStorage cache');
    } else {
      window.SITE_CONFIG = {};
    }
  } catch (e) {
    window.SITE_CONFIG = {};
  }

  // Get the base URL for the site (handles GitHub Pages repo paths and localhost)
  function getConfigUrl() {
    const origin = window.location.origin;
    const path = window.location.pathname;

    // On localhost or same-origin, use relative paths
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      const depth = (path.match(/\//g) || []).length - 1;
      if (depth <= 1) return './data/config.json';
      return '../'.repeat(depth - 1) + 'data/config.json';
    }

    // Get the script's own URL to determine the site root (for GitHub Pages etc.)
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src && script.src.includes('config-loader.js')) {
        const scriptUrl = new URL(script.src);
        const pathParts = scriptUrl.pathname.split('/');
        // Remove 'assets', 'js', 'config-loader.js' (3 parts) to get site root
        const siteRoot = pathParts.slice(0, -3).join('/') || '/';
        return siteRoot + '/data/config.json';
      }
    }

    // Fallback: try relative from current page
    const depth = (path.match(/\//g) || []).length - 1;
    if (depth <= 1) return './data/config.json';
    return '../'.repeat(depth - 1) + 'data/config.json';
  }

  // Load config from JSON file (updates the existing SITE_CONFIG)
  async function loadConfig() {
    // Skip fetch on file:// protocol - it will always fail due to CORS
    // The embedded fallback config in index.html will be used instead
    if (window.location.protocol === 'file:') {
      console.log('[Config Loader] file:// protocol detected, skipping fetch (using fallback config)');
      window.dispatchEvent(new CustomEvent('configLoaded', { detail: window.SITE_CONFIG }));
      return window.SITE_CONFIG;
    }

    const configUrl = getConfigUrl();
    console.log('[Config Loader] Fetching from:', configUrl);

    try {
      // Add cache-busting for development (remove or adjust for production)
      const response = await fetch(configUrl + '?v=' + Date.now());

      if (!response.ok) {
        throw new Error('Config fetch failed: ' + response.status);
      }

      const config = await response.json();
      console.log('[Config Loader] Fetch successful:', Object.keys(config));

      // Update global config
      window.SITE_CONFIG = config;

      // Cache in localStorage for offline fallback and other pages
      localStorage.setItem('conradSiteConfig', JSON.stringify(config));
      localStorage.setItem('conradConfigTimestamp', Date.now().toString());

      // Update individual storage keys for backward compatibility
      if (config.collection) {
        localStorage.setItem('conradCollection', JSON.stringify(config.collection));
      }
      if (config.writings) {
        localStorage.setItem('conradWritings', JSON.stringify(config.writings));
      }

      // Dispatch event to notify that config is loaded/updated
      window.dispatchEvent(new CustomEvent('configLoaded', { detail: config }));

      return config;

    } catch (error) {
      console.warn('[Config Loader] Fetch failed, using cached config:', error.message);

      // Already have SITE_CONFIG from localStorage init above
      // Just dispatch the event with current config
      window.dispatchEvent(new CustomEvent('configLoaded', { detail: window.SITE_CONFIG }));
      return window.SITE_CONFIG;
    }
  }

  // Helper to wait for config to be loaded (with timeout)
  window.waitForConfig = function(timeout = 5000) {
    // If config already loaded, return it immediately
    if (window.SITE_CONFIG && Object.keys(window.SITE_CONFIG).length > 0) {
      console.log('[Config Loader] Config already loaded');
      return Promise.resolve(window.SITE_CONFIG);
    }

    // If promise exists, wait for it with timeout
    if (window.configLoadPromise) {
      console.log('[Config Loader] Waiting for configLoadPromise...');
      return Promise.race([
        window.configLoadPromise,
        new Promise((resolve) => {
          setTimeout(() => {
            console.warn('[Config Loader] Timeout waiting for config, using fallback');
            resolve(window.SITE_CONFIG || {});
          }, timeout);
        })
      ]);
    }

    // Fallback - return empty config
    console.warn('[Config Loader] No promise found, returning empty config');
    return Promise.resolve({});
  };

  // Helper to get config value with fallback
  window.getConfigValue = function(path, fallback) {
    const config = window.SITE_CONFIG || {};
    const keys = path.split('.');
    let value = config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return fallback;
      }
    }

    return value !== undefined ? value : fallback;
  };

  // Auto-load config when script runs
  window.configLoadPromise = loadConfig();

})();
