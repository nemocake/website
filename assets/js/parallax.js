/**
 * Parallax Controller (parallax.js)
 * Scroll-based parallax effects using requestAnimationFrame and IntersectionObserver
 */
(function() {
  'use strict';

  // =========================================================================
  // CONFIGURATION
  // =========================================================================

  const CONFIG = {
    enabled: true,
    mobileBreakpoint: 768,
    reducedMotion: false,
    observerThreshold: 0.15,
    observerRootMargin: '0px 0px -50px 0px'
  };

  // =========================================================================
  // STATE
  // =========================================================================

  let rafId = null;
  let lastScrollY = 0;
  let parallaxElements = [];
  let scrollParallaxElements = [];
  let scrollDriveElements = [];
  let scrollCharElements = [];
  let isScrolling = false;
  let windowHeight = window.innerHeight;
  let windowWidth = window.innerWidth;

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  function init() {
    // Check for reduced motion preference
    CONFIG.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // Disable scroll-based parallax on mobile or reduced motion
    const isMobile = window.innerWidth <= CONFIG.mobileBreakpoint ||
                     'ontouchstart' in window ||
                     navigator.maxTouchPoints > 0;

    if (isMobile || CONFIG.reducedMotion) {
      CONFIG.enabled = false;
    }

    // Always initialize observers (CSS handles mobile fallback)
    initRevealObserver();
    initStaggerObserver();
    initWordObserver();
    initCharObserver();
    initSectionObserver();
    initSlideObserver();

    // Only init scroll parallax on desktop
    if (CONFIG.enabled) {
      collectParallaxElements();
      collectScrollParallaxElements();
      collectScrollDriveElements();
      collectScrollCharElements();
      initScrollListener();
      updateParallax();
    }

    // Handle resize
    window.addEventListener('resize', debounce(onResize, 200));
  }

  // =========================================================================
  // PARALLAX SCROLL HANDLING
  // =========================================================================

  function collectParallaxElements() {
    const elements = document.querySelectorAll('[data-parallax]');

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      parallaxElements.push({
        element: el,
        speed: parseFloat(el.dataset.parallaxSpeed) || 0.3,
        originalTop: rect.top + window.scrollY,
        height: rect.height
      });
    });
  }

  function getScrollTop() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function collectScrollParallaxElements() {
    const elements = document.querySelectorAll('[data-parallax-scroll]');
    const currentScroll = getScrollTop();

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const speed = el.dataset.parallaxScroll || 'medium';
      const direction = el.dataset.parallaxDirection === 'up' ? -1 : 1;

      // Get multiplier based on speed
      let multiplier = 0.1; // default medium
      if (speed === 'slow') multiplier = 0.05;
      if (speed === 'fast') multiplier = 0.15;

      scrollParallaxElements.push({
        element: el,
        multiplier: multiplier,
        direction: direction,
        originalTop: rect.top + currentScroll,
        height: rect.height
      });
    });
  }

  function collectScrollDriveElements() {
    const elements = document.querySelectorAll('[data-scroll-drive]');
    const currentScroll = getScrollTop();

    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const direction = el.dataset.scrollDrive || 'left'; // 'left' or 'right'
      const intensity = parseFloat(el.dataset.scrollDriveIntensity) || 1;

      scrollDriveElements.push({
        element: el,
        direction: direction,
        intensity: intensity,
        originalTop: rect.top + currentScroll,
        height: rect.height,
        index: index
      });
    });
  }

  function collectScrollCharElements() {
    const elements = document.querySelectorAll('[data-parallax-chars]');
    const currentScroll = getScrollTop();

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const chars = el.querySelectorAll('.parallax-char:not(.parallax-char--space)');

      scrollCharElements.push({
        element: el,
        chars: Array.from(chars),
        originalTop: rect.top + currentScroll,
        height: rect.height
      });
    });
  }

  function initScrollListener() {
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function onScroll() {
    lastScrollY = getScrollTop();

    if (!isScrolling) {
      isScrolling = true;
      rafId = requestAnimationFrame(updateParallax);
    }
  }

  function updateParallax() {
    if (!CONFIG.enabled) {
      isScrolling = false;
      return;
    }

    const scrollY = lastScrollY;

    // Update standard parallax elements
    parallaxElements.forEach(item => {
      const { element, speed, originalTop, height } = item;

      // Calculate element position relative to viewport
      const elementTop = originalTop - scrollY;
      const isInRange = elementTop < windowHeight + 200 &&
                        elementTop + height > -200;

      if (!isInRange) return;

      // Calculate parallax offset based on scroll position
      const centerOffset = elementTop - (windowHeight / 2) + (height / 2);
      const parallaxY = centerOffset * speed * -0.5;

      // Apply transform via CSS custom property
      element.style.setProperty('--parallax-y', `${parallaxY}px`);
    });

    // Update continuous scroll parallax elements
    scrollParallaxElements.forEach(item => {
      const { element, multiplier, direction, originalTop, height } = item;

      // Calculate element position relative to viewport
      const elementTop = originalTop - scrollY;
      const isInRange = elementTop < windowHeight + 300 &&
                        elementTop + height > -300;

      if (!isInRange) return;

      // Calculate scroll-based offset - moves continuously as user scrolls
      const scrollOffset = scrollY * multiplier * direction;

      // Apply transform via CSS custom property
      element.style.setProperty('--scroll-y', `${scrollOffset}px`);
    });

    // Update scroll-driven elements (slide in/out based on viewport position)
    scrollDriveElements.forEach(item => {
      const { element, direction, intensity, originalTop, height } = item;

      // Calculate element center position relative to viewport center
      const elementTop = originalTop - scrollY;
      const elementCenter = elementTop + (height / 2);
      const viewportCenter = windowHeight / 2;

      // Distance from viewport center (-1 to 1, where 0 = centered)
      // Negative = above center, Positive = below center
      const distanceFromCenter = (elementCenter - viewportCenter) / (windowHeight * 0.5);

      // Large dead zone: elements rest in place for most of the viewport
      const deadZone = 0.8; // 80% of viewport from center = elements rest here

      let effectiveDistance = 0;
      if (Math.abs(distanceFromCenter) > deadZone) {
        // Calculate how far beyond the dead zone we are
        // Gentle curve for smooth entry/exit
        const beyondDeadZone = Math.abs(distanceFromCenter) - deadZone;
        const maxBeyond = 2 - deadZone; // Maximum travel beyond dead zone
        effectiveDistance = Math.min(beyondDeadZone / maxBeyond, 1) * Math.sign(distanceFromCenter);
      }

      // Calculate horizontal offset - subtle slide from off-screen
      const maxOffset = windowWidth * 0.4 * intensity;
      let xOffset;

      if (direction === 'left') {
        xOffset = effectiveDistance * maxOffset * -1;
      } else {
        xOffset = effectiveDistance * maxOffset;
      }

      // Subtle rotation only when moving
      const rotation = effectiveDistance * 3 * (direction === 'left' ? -1 : 1);

      // Opacity: full when in dead zone, slight fade when moving
      const opacity = 1 - Math.abs(effectiveDistance) * 0.15;

      element.style.setProperty('--drive-x', `${xOffset}px`);
      element.style.setProperty('--drive-rotate', `${rotation}deg`);
      element.style.setProperty('--drive-opacity', Math.max(0.5, opacity));
    });

    // Update scroll-driven character animations
    scrollCharElements.forEach(item => {
      const { element, chars, originalTop, height } = item;

      // Calculate element center position relative to viewport center
      const elementTop = originalTop - scrollY;
      const elementCenter = elementTop + (height / 2);
      const viewportCenter = windowHeight / 2;

      // Distance from viewport center (-1 to 1, where 0 = centered)
      const distanceFromCenter = (elementCenter - viewportCenter) / (windowHeight * 0.5);

      // Large dead zone matching cards - headers rest for most of viewport
      const deadZone = 0.8;

      let effectiveDistance = 0;
      if (Math.abs(distanceFromCenter) > deadZone) {
        const beyondDeadZone = Math.abs(distanceFromCenter) - deadZone;
        const maxBeyond = 2 - deadZone;
        effectiveDistance = Math.min(beyondDeadZone / maxBeyond, 1) * Math.sign(distanceFromCenter);
      }

      // Animate each character with stagger - subtle horizontal slide
      chars.forEach((char, i) => {
        // Stagger the animation - later chars animate slightly behind
        const staggerOffset = i * 0.015;
        const charDistance = Math.max(-1, Math.min(1, effectiveDistance + (effectiveDistance !== 0 ? staggerOffset * Math.sign(effectiveDistance) : 0)));

        // Subtle horizontal movement
        const translateX = charDistance * -80;
        const rotateY = charDistance * 12;
        const scale = 1 - Math.abs(charDistance) * 0.15;
        const opacity = 1 - Math.abs(charDistance) * 0.4;

        char.style.transform = `translateX(${translateX}%) rotateY(${rotateY}deg) scale(${scale})`;
        char.style.opacity = Math.max(0.3, opacity);
      });
    });

    isScrolling = false;
  }

  // =========================================================================
  // REVEAL OBSERVER
  // Fade in elements as they enter viewport
  // =========================================================================

  function initRevealObserver() {
    const elements = document.querySelectorAll('[data-parallax-reveal]');

    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.observerThreshold,
      rootMargin: CONFIG.observerRootMargin
    });

    elements.forEach(el => observer.observe(el));
  }

  // =========================================================================
  // STAGGER OBSERVER
  // Animate children in sequence
  // =========================================================================

  function initStaggerObserver() {
    const containers = document.querySelectorAll('[data-parallax-stagger]');

    if (containers.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -30px 0px'
    });

    containers.forEach(el => observer.observe(el));
  }

  // =========================================================================
  // WORD ANIMATION OBSERVER
  // Animate text word by word
  // =========================================================================

  function initWordObserver() {
    const elements = document.querySelectorAll('[data-parallax-words]');

    if (elements.length === 0) return;

    // First, wrap words in spans
    elements.forEach(el => {
      if (el.dataset.parallaxWordsProcessed) return;

      const text = el.textContent.trim();
      const words = text.split(/\s+/);

      el.innerHTML = words.map((word, i) =>
        `<span class="parallax-word" style="transition-delay: ${i * 60}ms">${word}</span>`
      ).join(' ');

      el.dataset.parallaxWordsProcessed = 'true';
    });

    // Then observe for visibility
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '0px 0px -20px 0px'
    });

    elements.forEach(el => observer.observe(el));
  }

  // =========================================================================
  // CHARACTER ANIMATION SETUP
  // Wrap text in character spans for scroll-driven animation
  // =========================================================================

  function initCharObserver() {
    const elements = document.querySelectorAll('[data-parallax-chars]');

    if (elements.length === 0) return;

    // Wrap characters in spans for animation
    elements.forEach(el => {
      if (el.dataset.parallaxCharsProcessed) return;

      const text = el.textContent.trim();
      const chars = text.split('');

      el.innerHTML = chars.map((char, i) => {
        // Preserve spaces
        if (char === ' ') {
          return '<span class="parallax-char parallax-char--space">&nbsp;</span>';
        }
        return `<span class="parallax-char">${char}</span>`;
      }).join('');

      el.dataset.parallaxCharsProcessed = 'true';
    });

    // Note: Animation is handled by scroll-driven updates in updateParallax()
    // On mobile/reduced-motion, CSS overrides ensure visibility
  }

  // =========================================================================
  // SECTION OBSERVER
  // Animate entire sections
  // =========================================================================

  function initSectionObserver() {
    const sections = document.querySelectorAll('[data-parallax-section]');

    if (sections.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });

    sections.forEach(section => observer.observe(section));
  }

  // =========================================================================
  // SLIDE OBSERVER
  // Animate elements sliding in from left or right
  // =========================================================================

  function initSlideObserver() {
    const slideElements = document.querySelectorAll(
      '[data-parallax-slide-left], [data-parallax-slide-right], [data-parallax-slide-stagger]'
    );

    if (slideElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    slideElements.forEach(el => observer.observe(el));
  }

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function onResize() {
    windowHeight = window.innerHeight;
    windowWidth = window.innerWidth;

    // Recalculate element positions for standard parallax
    parallaxElements.forEach(item => {
      const rect = item.element.getBoundingClientRect();
      item.originalTop = rect.top + window.scrollY;
      item.height = rect.height;
    });

    // Recalculate element positions for scroll parallax
    scrollParallaxElements.forEach(item => {
      const rect = item.element.getBoundingClientRect();
      item.originalTop = rect.top + window.scrollY;
      item.height = rect.height;
    });

    // Recalculate element positions for scroll-drive
    scrollDriveElements.forEach(item => {
      const rect = item.element.getBoundingClientRect();
      item.originalTop = rect.top + window.scrollY;
      item.height = rect.height;
    });

    // Recalculate element positions for scroll-driven chars
    scrollCharElements.forEach(item => {
      const rect = item.element.getBoundingClientRect();
      item.originalTop = rect.top + window.scrollY;
      item.height = rect.height;
    });

    // Check if we should enable/disable based on new width
    const isMobile = window.innerWidth <= CONFIG.mobileBreakpoint;
    const wasEnabled = CONFIG.enabled;

    CONFIG.enabled = !isMobile && !CONFIG.reducedMotion && !('ontouchstart' in window);

    // If transitioning states, update or clear transforms
    if (wasEnabled && !CONFIG.enabled) {
      parallaxElements.forEach(item => {
        item.element.style.removeProperty('--parallax-y');
      });
      scrollParallaxElements.forEach(item => {
        item.element.style.removeProperty('--scroll-y');
      });
      scrollDriveElements.forEach(item => {
        item.element.style.removeProperty('--drive-x');
        item.element.style.removeProperty('--drive-opacity');
      });
    }
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  window.ParallaxController = {
    init,
    refresh: () => {
      parallaxElements = [];
      scrollParallaxElements = [];
      scrollDriveElements = [];
      scrollCharElements = [];
      collectParallaxElements();
      collectScrollParallaxElements();
      collectScrollDriveElements();
      collectScrollCharElements();
      // Trigger immediate update
      if (CONFIG.enabled) {
        updateParallax();
      }
    },
    enable: () => {
      CONFIG.enabled = true;
      initScrollListener();
    },
    disable: () => {
      CONFIG.enabled = false;
      parallaxElements.forEach(item => {
        item.element.style.removeProperty('--parallax-y');
      });
      scrollParallaxElements.forEach(item => {
        item.element.style.removeProperty('--scroll-y');
      });
      scrollDriveElements.forEach(item => {
        item.element.style.removeProperty('--drive-x');
        item.element.style.removeProperty('--drive-opacity');
      });
      scrollCharElements.forEach(item => {
        item.chars.forEach(char => {
          char.style.removeProperty('transform');
          char.style.removeProperty('opacity');
        });
      });
    },
    destroy: () => {
      CONFIG.enabled = false;
      window.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      parallaxElements = [];
      scrollParallaxElements = [];
      scrollDriveElements = [];
      scrollCharElements = [];
    }
  };

  // =========================================================================
  // AUTO-INITIALIZE
  // =========================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
