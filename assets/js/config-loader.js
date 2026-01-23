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

  // Determine the base path based on current page location
  function getBasePath() {
    const path = window.location.pathname;

    // Handle Windows file paths and various server configurations
    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');

    // Check if we're at the root (index.html or just /)
    if (normalizedPath === '/' ||
        normalizedPath.endsWith('/index.html') && normalizedPath.split('/').filter(Boolean).length <= 1) {
      return './';
    }

    // Count directory segments after the domain root
    // Remove trailing filename if present
    const pathWithoutFile = normalizedPath.replace(/\/[^\/]*\.[^\/]*$/, '');
    const segments = pathWithoutFile.split('/').filter(Boolean);

    // For paths like /writings/index.html, we need to go up one level
    if (segments.length === 0) return './';
    return '../'.repeat(segments.length);
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

    const basePath = getBasePath();
    const configUrl = basePath + 'data/config.json';

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
