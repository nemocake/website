/**
 * Navigation Component
 * Mobile navigation toggle functionality
 */

class Navigation {
  constructor() {
    this.toggle = document.querySelector('.nav-toggle');
    this.mobileNav = document.querySelector('.mobile-nav');
    this.isOpen = false;
    
    if (this.toggle && this.mobileNav) {
      this.init();
    }
  }
  
  init() {
    // Toggle button click
    this.toggle.addEventListener('click', () => this.toggleNav());
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeNav();
      }
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.toggle.contains(e.target) && !this.mobileNav.contains(e.target)) {
        this.closeNav();
      }
    });
    
    // Close on resize to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768 && this.isOpen) {
        this.closeNav();
      }
    });
    
    // Handle mobile nav link clicks
    const navLinks = this.mobileNav.querySelectorAll('.mobile-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => this.closeNav());
    });
  }
  
  toggleNav() {
    this.isOpen ? this.closeNav() : this.openNav();
  }
  
  openNav() {
    this.isOpen = true;
    this.toggle.classList.add('is-active');
    this.mobileNav.classList.add('is-open');
    this.toggle.setAttribute('aria-expanded', 'true');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }
  
  closeNav() {
    this.isOpen = false;
    this.toggle.classList.remove('is-active');
    this.mobileNav.classList.remove('is-open');
    this.toggle.setAttribute('aria-expanded', 'false');
    
    // Restore body scroll
    document.body.style.overflow = '';
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new Navigation();
});

// Export for manual initialization
window.Navigation = Navigation;
