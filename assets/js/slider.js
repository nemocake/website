/**
 * Slider Component
 * Lightweight vanilla JS slider with data attribute configuration
 * 
 * Usage:
 * <div class="slider" data-autoplay="true" data-interval="5000">
 *   <div class="slider__track">
 *     <div class="slider__slide">...</div>
 *   </div>
 * </div>
 * 
 * Data attributes:
 * - data-autoplay: Enable auto-sliding (true/false)
 * - data-interval: Time between slides in ms (default: 5000)
 * - data-loop: Enable infinite loop (default: true)
 * - data-pause-on-hover: Pause autoplay on hover (default: true)
 */

class Slider {
  constructor(element) {
    this.slider = element;
    this.track = element.querySelector('.slider__track');
    this.slides = Array.from(element.querySelectorAll('.slider__slide'));
    
    if (!this.track || this.slides.length === 0) return;
    
    // Configuration from data attributes
    this.autoplay = this.slider.dataset.autoplay === 'true';
    this.interval = parseInt(this.slider.dataset.interval) || 5000;
    this.loop = this.slider.dataset.loop !== 'false';
    this.pauseOnHover = this.slider.dataset.pauseOnHover !== 'false';
    
    // State
    this.currentIndex = 0;
    this.autoplayTimer = null;
    this.isPlaying = false;
    
    this.init();
  }
  
  init() {
    this.createNavigation();
    this.createDots();
    this.bindEvents();
    this.updateSlider();
    
    if (this.autoplay) {
      this.startAutoplay();
    }
  }
  
  createNavigation() {
    // Check if navigation already exists
    if (this.slider.querySelector('.slider__prev')) return;
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'slider__prev';
    prevBtn.setAttribute('aria-label', 'Previous slide');
    prevBtn.innerHTML = '<span class="slider__arrow slider__arrow--left"></span>';
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'slider__next';
    nextBtn.setAttribute('aria-label', 'Next slide');
    nextBtn.innerHTML = '<span class="slider__arrow slider__arrow--right"></span>';
    
    this.slider.appendChild(prevBtn);
    this.slider.appendChild(nextBtn);
    
    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
  }
  
  createDots() {
    // Check if dots container already exists
    let dotsContainer = this.slider.querySelector('.slider__dots');
    if (!dotsContainer) {
      dotsContainer = document.createElement('div');
      dotsContainer.className = 'slider__dots';
      this.slider.appendChild(dotsContainer);
    }
    
    // Clear existing dots
    dotsContainer.innerHTML = '';
    
    // Create dots for each slide
    this.slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = 'slider__dot';
      dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
      dot.addEventListener('click', () => this.goToSlide(index));
      dotsContainer.appendChild(dot);
    });
    
    this.dots = Array.from(dotsContainer.querySelectorAll('.slider__dot'));
  }
  
  bindEvents() {
    // Navigation buttons
    this.prevBtn?.addEventListener('click', () => this.prev());
    this.nextBtn?.addEventListener('click', () => this.next());
    
    // Pause on hover
    if (this.pauseOnHover && this.autoplay) {
      this.slider.addEventListener('mouseenter', () => this.pauseAutoplay());
      this.slider.addEventListener('mouseleave', () => this.resumeAutoplay());
    }
    
    // Keyboard navigation
    this.slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });
    
    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;
    
    this.slider.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    this.slider.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe(touchStartX, touchEndX);
    }, { passive: true });
  }
  
  handleSwipe(startX, endX) {
    const threshold = 50;
    const diff = startX - endX;
    
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.next();
      } else {
        this.prev();
      }
    }
  }
  
  goToSlide(index) {
    if (index < 0) {
      this.currentIndex = this.loop ? this.slides.length - 1 : 0;
    } else if (index >= this.slides.length) {
      this.currentIndex = this.loop ? 0 : this.slides.length - 1;
    } else {
      this.currentIndex = index;
    }
    
    this.updateSlider();
  }
  
  prev() {
    this.goToSlide(this.currentIndex - 1);
  }
  
  next() {
    this.goToSlide(this.currentIndex + 1);
  }
  
  updateSlider() {
    // Update track position
    const offset = -this.currentIndex * 100;
    this.track.style.transform = `translateX(${offset}%)`;
    
    // Update dots
    this.dots?.forEach((dot, index) => {
      dot.classList.toggle('is-active', index === this.currentIndex);
    });
    
    // Update navigation buttons (disable at ends if not looping)
    if (!this.loop) {
      this.prevBtn?.toggleAttribute('disabled', this.currentIndex === 0);
      this.nextBtn?.toggleAttribute('disabled', this.currentIndex === this.slides.length - 1);
    }
    
    // Dispatch custom event
    this.slider.dispatchEvent(new CustomEvent('slidechange', {
      detail: { index: this.currentIndex }
    }));
  }
  
  startAutoplay() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.autoplayTimer = setInterval(() => this.next(), this.interval);
  }
  
  pauseAutoplay() {
    this.isPlaying = false;
    this.slider.classList.add('is-paused');
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }
  
  resumeAutoplay() {
    if (!this.autoplay) return;
    this.slider.classList.remove('is-paused');
    this.startAutoplay();
  }
  
  destroy() {
    this.pauseAutoplay();
    // Remove event listeners if needed
  }
}

// Auto-initialize all sliders on page load
document.addEventListener('DOMContentLoaded', () => {
  const sliders = document.querySelectorAll('.slider');
  sliders.forEach(slider => new Slider(slider));
});

// Export for manual initialization
window.Slider = Slider;
